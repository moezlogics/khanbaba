import { A } from "./admin-theme"

/**
 * Draft Keeper — stops anything typed in the admin from disappearing.
 *
 * The problem: a long product (or blog post, or spec sheet) lives only in
 * React state while it is being filled in. A dropped connection, an
 * expired session, or an accidental reload bounces the page and takes the
 * whole form with it.
 *
 * What this does, on every admin page including the built-in Medusa ones:
 *   - mirrors every field being typed into localStorage, debounced
 *   - flushes that mirror the moment something goes wrong — a failed
 *     request, a 401, the tab being hidden or closed
 *   - on the next visit to the same page, compares the stored draft with
 *     what the page loaded and offers to put the difference back
 *   - warns before a reload/close while there is unsaved text
 *   - pings the session every few minutes so an idle expiry is noticed
 *     while the data is still on screen rather than after it is gone
 *
 * It never saves to the server by itself: restoring is always a click, and
 * the real save is still the page's own Save/Publish button.
 *
 * Installed by `widgets/draft-keeper.tsx` on the built-in pages, and by a
 * side-effect import in each custom route. Installing twice is a no-op.
 */

const STORAGE_PREFIX = "zm-draft:"
const DRAFT_VERSION = 1

/** Drafts older than this are junk — the work was finished or abandoned. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000
const MAX_DRAFTS = 25

const SAVE_DEBOUNCE_MS = 600
const ROUTE_POLL_MS = 500
/**
 * A form fills in from the server over a second or two, so compare the
 * stored draft against it repeatedly rather than once at a guessed moment.
 */
const COMPARE_AT_MS = [1200, 2500, 4000, 6500]
/** After a restore, keep filling fields that appear later (other tabs). */
const PENDING_WINDOW_MS = 3 * 60 * 1000
const KEEPALIVE_MS = 4 * 60 * 1000

type Draft = {
  v: number
  t: number
  path: string
  fields: Record<string, string>
}

/* ------------------------------------------------------------------ *
 * Reading the page
 * ------------------------------------------------------------------ */

const FIELD_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(",")

/** Never mirrored: secrets, uploads, and the browser's own controls. */
const SKIP_INPUT_TYPES = new Set([
  "password",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "search",
])

function isCapturable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  // Escape hatches: opt a subtree out with data-draft-ignore, and never
  // mirror the command palette or a filter box — that is noise, not work.
  if (el.closest("[data-draft-ignore]")) return false
  if (el.closest("[cmdk-root]")) return false
  if (el instanceof HTMLInputElement) {
    if (SKIP_INPUT_TYPES.has((el.type || "text").toLowerCase())) return false
  }
  const hint = `${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`
  if (hint.toLowerCase().includes("search")) return false
  return true
}

/** Radix/React generated ids change on every render — useless as keys. */
function looksGenerated(id: string): boolean {
  return !id || id.includes(":") || /^(radix|headlessui|react-aria)/i.test(id)
}

function labelTextFor(el: HTMLElement): string {
  try {
    if (el.id && !looksGenerated(el.id)) {
      const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (byFor?.textContent) return byFor.textContent
    }
  } catch {
    /* CSS.escape missing or a malformed id — fall through */
  }
  return el.closest("label")?.textContent || ""
}

/**
 * A key that survives a reload. `name` (react-hook-form puts one on every
 * field of the stock product form) is best; otherwise fall back to the
 * visible label, which only changes when the page itself changes.
 */
function buildKey(el: HTMLElement, used: Set<string>): string {
  const name = el.getAttribute("name")
  let base: string
  if (name) {
    base = `n:${name}`
  } else if (!looksGenerated(el.id)) {
    base = `i:${el.id}`
  } else {
    const hint = (
      el.getAttribute("aria-label") ||
      el.getAttribute("placeholder") ||
      labelTextFor(el)
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
    base = `l:${el.tagName.toLowerCase()}:${hint}`
  }
  let key = base
  let n = 2
  while (used.has(key)) key = `${base}#${n++}`
  used.add(key)
  return key
}

function scanFields(): Map<HTMLElement, string> {
  const found = new Map<HTMLElement, string>()
  const used = new Set<string>()
  document.querySelectorAll(FIELD_SELECTOR).forEach((node) => {
    if (isCapturable(node)) found.set(node, buildKey(node, used))
  })
  return found
}

function readValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") return el.checked ? "1" : "0"
    return el.value
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value
  return el.innerHTML
}

/**
 * Everything the page is showing, plus which of those fields the operator
 * has actually edited. The second half matters: an untouched empty field
 * must never be allowed to erase what the draft holds for it.
 */
function readPage(edited?: WeakSet<HTMLElement>): {
  values: Record<string, string>
  touched: Set<string>
} {
  const values: Record<string, string> = {}
  const touched = new Set<string>()
  scanFields().forEach((key, el) => {
    values[key] = readValue(el)
    if (edited?.has(el)) touched.add(key)
  })
  return { values, touched }
}

/** Empty, "off", or markup with no words in it — not worth restoring. */
function isMeaningful(value: string): boolean {
  if (!value || value === "0") return false
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0
}

/* ------------------------------------------------------------------ *
 * Writing back into the page
 * ------------------------------------------------------------------ */

/**
 * React tracks the last value it wrote to a node, so assigning `.value`
 * directly is swallowed on the next render. Going through the prototype
 * setter and then firing `input` is what makes React accept the change.
 */
function nativeValueSetter(el: HTMLElement): ((value: string) => void) | null {
  const proto =
    el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : null
  if (!proto) return null
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  return setter ? (value: string) => setter.call(el, value) : null
}

/**
 * Rich text (TipTap/ProseMirror) keeps its own document model, so pushing
 * innerHTML at it can desync the editor. Pasting through execCommand goes
 * in via the editor's own input handling; innerHTML is the last resort.
 */
function writeRichText(el: HTMLElement, html: string): void {
  try {
    el.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection?.removeAllRanges()
    selection?.addRange(range)
    if (document.execCommand("insertHTML", false, html)) return
  } catch {
    /* fall through to the blunt version */
  }
  el.innerHTML = html
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

function writeValue(el: HTMLElement, value: string): void {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    if (el.checked !== (value === "1")) el.click()
    return
  }
  if (el.isContentEditable) {
    writeRichText(el, value)
    return
  }
  const setter = nativeValueSetter(el)
  if (setter) setter(value)
  else (el as HTMLInputElement).value = value
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

const storageKey = (path: string) => STORAGE_PREFIX + path

function readDraft(path: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(path))
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    if (!draft || draft.v !== DRAFT_VERSION || !draft.fields) return null
    if (Date.now() - draft.t > KEEP_MS) {
      localStorage.removeItem(storageKey(path))
      return null
    }
    return draft
  } catch {
    return null
  }
}

function dropDraft(path: string): void {
  try {
    localStorage.removeItem(storageKey(path))
  } catch {
    /* storage unavailable — nothing to drop */
  }
}

function prune(aggressive = false): void {
  try {
    const entries: { key: string; t: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(STORAGE_PREFIX)) continue
      let t = 0
      try {
        t = (JSON.parse(localStorage.getItem(key) || "{}") as Draft).t || 0
      } catch {
        t = 0
      }
      entries.push({ key, t })
    }
    const now = Date.now()
    const fresh: { key: string; t: number }[] = []
    entries.forEach((e) => {
      if (now - e.t > KEEP_MS) localStorage.removeItem(e.key)
      else fresh.push(e)
    })
    fresh.sort((a, b) => b.t - a.t)
    fresh.slice(aggressive ? Math.floor(MAX_DRAFTS / 2) : MAX_DRAFTS).forEach((e) => {
      localStorage.removeItem(e.key)
    })
  } catch {
    /* storage unavailable */
  }
}

function writeDraft(draft: Draft): void {
  const payload = JSON.stringify(draft)
  try {
    localStorage.setItem(storageKey(draft.path), payload)
  } catch {
    // Almost always the quota: make room from the oldest drafts and retry
    // once. If it still fails the page keeps working, just unprotected.
    prune(true)
    try {
      localStorage.setItem(storageKey(draft.path), payload)
    } catch {
      /* give up silently */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Small UI — plain DOM so it outlives every React route change
 * ------------------------------------------------------------------ */

function style(el: HTMLElement, props: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, props)
}

function uiRoot(): HTMLElement {
  const existing = document.getElementById("zm-draft-ui")
  if (existing) return existing
  const root = document.createElement("div")
  root.id = "zm-draft-ui"
  style(root, {
    position: "fixed",
    left: "16px",
    bottom: "16px",
    zIndex: "2147483000",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    pointerEvents: "none",
    fontSize: "13px",
  })
  document.body.appendChild(root)
  return root
}

function makeButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.textContent = label
  style(btn, {
    cursor: "pointer",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    border: primary ? "1px solid transparent" : A.border,
    background: primary ? A.interactive : "transparent",
    color: primary ? "#0b0b0b" : A.fgSubtle,
  })
  btn.addEventListener("click", onClick)
  return btn
}

function formatAge(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}

/* ------------------------------------------------------------------ *
 * The keeper
 * ------------------------------------------------------------------ */

let installed = false

export function installDraftKeeper(): void {
  if (installed || typeof window === "undefined" || !window.localStorage) return
  installed = true

  let path = location.pathname
  /**
   * Only mirror once the operator has touched this page, so a form that is
   * still loading can never overwrite a good draft with its blanks.
   */
  let typedHere = false
  /** Typed since the last successful save — drives the leave warning. */
  let dirty = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let compareTimers: ReturnType<typeof setTimeout>[] = []
  let pending: Record<string, string> = {}
  let pendingUntil = 0
  /** Fields the operator has edited, so clearing one is respected. */
  let editedFields = new WeakSet<HTMLElement>()
  let bar: HTMLElement | null = null
  /** Timestamp of the draft the prompt is currently offering, if any. */
  let barFor: number | null = null
  /** Set once the operator has answered the prompt on this page visit. */
  let settled = false
  let pill: HTMLElement | null = null

  const isCreateScope = (p: string) => /\/(create|new)(\/|$)/.test(p)
  const isLoginScope = (p: string) => p.includes("/login") || p.includes("/reset-password")

  /* ---- mirror ---- */

  function saveNow(): void {
    if (!typedHere || isLoginScope(path)) return
    const { values, touched } = readPage(editedFields)
    // Start from what is already stored: fields on a collapsed section or
    // another tab are not in the DOM and would otherwise be dropped.
    const fields = { ...(readDraft(path)?.fields || {}) }
    Object.entries(values).forEach(([key, value]) => {
      // An empty field only overwrites a stored value when the operator
      // cleared it themselves. Without this, a form that has not finished
      // loading could wipe the very draft it is about to be offered.
      if (touched.has(key) || isMeaningful(value)) fields[key] = value
    })
    if (!Object.values(fields).some(isMeaningful)) {
      dropDraft(path)
      return
    }
    writeDraft({ v: DRAFT_VERSION, t: Date.now(), path, fields })
    showPill()
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS)
  }

  /* ---- restore ---- */

  function applyPending(): number {
    if (!Object.keys(pending).length) return 0
    let filled = 0
    scanFields().forEach((key, el) => {
      const value = pending[key]
      if (value === undefined) return
      // Never clobber something already on screen — only fill the blanks.
      if (isMeaningful(readValue(el))) return
      writeValue(el, value)
      delete pending[key]
      filled++
    })
    return filled
  }

  function restore(draft: Draft): void {
    pending = { ...draft.fields }
    pendingUntil = Date.now() + PENDING_WINDOW_MS
    typedHere = true
    dirty = true
    const filled = applyPending()
    stopPrompting()
    // Re-mirror straight away: what is on screen now IS the draft, and
    // without this the next comparison would see them agree and bin it.
    saveNow()
    showPill(filled === 1 ? "1 field restored" : `${filled} fields restored`)
  }

  /* ---- the restore prompt ---- */

  function hideBar(): void {
    bar?.remove()
    bar = null
    barFor = null
  }

  /** The operator has answered: stop re-offering for this page visit. */
  function stopPrompting(): void {
    settled = true
    compareTimers.forEach(clearTimeout)
    compareTimers = []
    hideBar()
  }

  function showBar(draft: Draft, changed: number): void {
    if (barFor === draft.t) return
    hideBar()
    barFor = draft.t
    bar = document.createElement("div")
    style(bar, {
      pointerEvents: "auto",
      maxWidth: "340px",
      padding: "12px 14px",
      borderRadius: "10px",
      border: `1px solid ${A.warning}`,
      background: A.bgCard,
      color: A.fg,
      boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    })

    const heading = document.createElement("div")
    heading.textContent = "Unsaved work found"
    style(heading, { fontWeight: "600", marginBottom: "2px" })

    const detail = document.createElement("div")
    detail.textContent = `${changed} field${changed === 1 ? "" : "s"} from ${formatAge(
      Date.now() - draft.t
    )} are not on this page.`
    style(detail, { color: A.fgSubtle, fontSize: "12px", marginBottom: "10px" })

    const actions = document.createElement("div")
    style(actions, { display: "flex", gap: "8px" })
    actions.appendChild(makeButton("Put it back", true, () => restore(draft)))
    actions.appendChild(
      makeButton("Discard", false, () => {
        dropDraft(path)
        stopPrompting()
      })
    )

    bar.append(heading, detail, actions)
    uiRoot().appendChild(bar)
  }

  /**
   * Offer the draft only when it genuinely differs from what the page is
   * showing. Fields the page has not rendered are ignored here — those
   * ride along in `pending` once the operator accepts.
   */
  function compareWithPage(): void {
    if (settled || isLoginScope(path)) return
    const draft = readDraft(path)
    if (!draft) return
    const { values } = readPage()
    let changed = 0
    let comparable = 0
    Object.entries(draft.fields).forEach(([key, value]) => {
      if (!(key in values)) return
      comparable++
      if (isMeaningful(value) && values[key] !== value) changed++
    })
    if (changed > 0) {
      showBar(draft, changed)
    } else if (comparable > 0) {
      // The page already shows everything the draft holds, so it is just a
      // copy of saved data. Drop it rather than offer it again later.
      hideBar()
      dropDraft(path)
    }
  }

  /* ---- "draft saved" pill ---- */

  function showPill(message?: string): void {
    if (!pill) {
      pill = document.createElement("div")
      style(pill, {
        padding: "5px 10px",
        borderRadius: "999px",
        border: A.border,
        background: A.bgSubtle,
        color: A.fgSubtle,
        fontSize: "11px",
        opacity: "0.65",
      })
      uiRoot().appendChild(pill)
    }
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    pill.textContent = message ? `✓ ${message}` : `✓ Draft kept — ${time}`
  }

  function clearPill(): void {
    pill?.remove()
    pill = null
  }

  /* ---- route changes ---- */

  function onRouteChange(): void {
    saveNow()
    path = location.pathname
    typedHere = false
    dirty = false
    settled = false
    pending = {}
    editedFields = new WeakSet<HTMLElement>()
    hideBar()
    clearPill()
    if (isLoginScope(path)) clearSessionBanner()
    compareTimers.forEach(clearTimeout)
    compareTimers = COMPARE_AT_MS.map((delay) => setTimeout(compareWithPage, delay))
  }

  /* ---- session ---- */

  const originalFetch: typeof window.fetch = window.fetch.bind(window)

  function clearSessionBanner(): void {
    document.getElementById("zm-draft-session")?.remove()
  }

  function onSessionLost(): void {
    saveNow()
    // On the login screen a 401 is simply "not logged in yet", not a
    // session that died while work was on screen.
    if (isLoginScope(path)) return
    if (document.getElementById("zm-draft-session")) return
    const warning = document.createElement("div")
    warning.id = "zm-draft-session"
    style(warning, {
      pointerEvents: "auto",
      maxWidth: "340px",
      padding: "12px 14px",
      borderRadius: "10px",
      border: `1px solid ${A.danger}`,
      background: A.bgCard,
      color: A.fg,
      boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    })
    const heading = document.createElement("div")
    heading.textContent = "Session expired"
    style(heading, { fontWeight: "600", marginBottom: "2px" })
    const detail = document.createElement("div")
    detail.textContent =
      "Your typing is saved. Log in again in a new tab, come back here, and reload — you will be offered it back."
    style(detail, { color: A.fgSubtle, fontSize: "12px" })
    warning.append(heading, detail)
    uiRoot().appendChild(warning)
  }

  if (!(window.fetch as { __zmDraftKeeper?: boolean }).__zmDraftKeeper) {
    const patched = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const method = (
        init?.method ||
        (input instanceof Request ? input.method : "GET")
      ).toUpperCase()
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const isWrite = method !== "GET" && method !== "HEAD"
      try {
        const response = await originalFetch(input, init)
        if (response.status === 401) onSessionLost()
        else if (response.ok && url.includes("/admin/")) clearSessionBanner()
        if (isWrite && response.ok && url.includes("/admin/")) {
          dirty = false
          // The data is in the database now. A create form is finished with,
          // so its draft goes; elsewhere re-mirror, because a page can hold
          // several independent sections and only one of them was saved.
          if (isCreateScope(path)) {
            dropDraft(path)
            typedHere = false
            clearPill()
          } else {
            saveNow()
          }
        }
        return response
      } catch (error) {
        // Network died mid-save — this is exactly the moment the form used
        // to be lost, so get it to disk before anything else happens.
        if (isWrite) saveNow()
        throw error
      }
    } as typeof window.fetch
    ;(patched as { __zmDraftKeeper?: boolean }).__zmDraftKeeper = true
    window.fetch = patched
  }

  /* ---- wiring ---- */

  function fieldOf(event: Event): HTMLElement | null {
    const target = event.target
    if (!(target instanceof HTMLElement)) return null
    // `closest` so a keystroke inside a rich-text editor resolves to the
    // editable root rather than whichever paragraph it landed in.
    const field = target.closest(FIELD_SELECTOR)
    return field && isCapturable(field) ? field : null
  }

  const onEdit = (event: Event) => {
    const field = fieldOf(event)
    if (!field) return
    // A synthetic event before the operator has touched anything is the
    // page filling itself in, which is not a reason to start mirroring.
    if (!event.isTrusted && !typedHere) return
    editedFields.add(field)
    typedHere = true
    dirty = true
    scheduleSave()
  }
  document.addEventListener("input", onEdit, true)
  document.addEventListener("change", onEdit, true)

  // Dropdowns, switches and date pickers change their value from a click
  // handler, and the event that follows is often synthetic. Treating real
  // contact with a field as the start of editing lets those through.
  const onTouchField = (event: Event) => {
    if (event.isTrusted && fieldOf(event)) typedHere = true
  }
  document.addEventListener("pointerdown", onTouchField, true)
  document.addEventListener("keydown", onTouchField, true)

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow()
  })
  window.addEventListener("pagehide", saveNow)
  window.addEventListener("beforeunload", (event) => {
    saveNow()
    if (!dirty) return
    // Browsers ignore custom text here; any non-empty value shows their
    // own "Leave site?" dialog, which is the point.
    event.preventDefault()
    event.returnValue = ""
  })

  // React Router navigates without a page load, so watch the path itself
  // rather than trying to hook into the router from outside it.
  setInterval(() => {
    if (location.pathname !== path) onRouteChange()
  }, ROUTE_POLL_MS)

  // Tabs and accordions mount their fields late; keep filling a restored
  // draft into them for a few minutes after the operator accepts it.
  const observer = new MutationObserver(() => {
    if (Date.now() > pendingUntil || !Object.keys(pending).length) return
    applyPending()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Notice an idle expiry while the work is still on screen.
  setInterval(() => {
    if (document.visibilityState !== "visible" || isLoginScope(path)) return
    originalFetch("/admin/users/me", {
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then((response) => {
        if (response.status === 401) onSessionLost()
      })
      .catch(() => {
        /* offline — the mirror already covers this */
      })
  }, KEEPALIVE_MS)

  prune()
  compareTimers = COMPARE_AT_MS.map((delay) => setTimeout(compareWithPage, delay))
}

// Self-installing: importing this module anywhere in the admin is enough.
installDraftKeeper()
