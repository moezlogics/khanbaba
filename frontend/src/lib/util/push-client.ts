/**
 * Browser-side helpers for Web Push subscription.
 *
 * Flow:
 *   1. `isPushSupported()` — quick capability check
 *   2. `getCurrentPermission()` — read Notification.permission
 *   3. `subscribeToPush({ vapidPublicKey, customerId? })`
 *      → registers /sw.js, calls Notification.requestPermission(),
 *        creates a PushSubscription, and POSTs the result to the backend.
 *   4. `unsubscribeFromPush()` — undoes the above and DELETEs server-side
 *
 * Geo (city / state / country) is resolved SERVER-SIDE in the backend
 * route from the request IP. Client-side IP geo APIs (ipapi.co etc.)
 * are blocked by ad-blockers and rate-limit aggressively, so we don't
 * call them anymore — the backend has the real client IP via headers
 * and can do the lookup reliably with cache.
 */

import {
  postSubscription,
  deleteSubscription,
} from "@lib/data/push-subscriptions"

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function getCurrentPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

/**
 * Does this existing subscription belong to `expected` (our VAPID key)?
 *
 * `options.applicationServerKey` is the raw key the subscription was
 * created with. Browsers that don't expose it (older Safari) return
 * null/undefined — we treat that as "assume it matches" rather than
 * churning a subscription we cannot verify.
 */
function subscriptionUsesKey(
  sub: PushSubscription,
  expected: Uint8Array
): boolean {
  let actual: ArrayBuffer | null | undefined
  try {
    actual = sub.options?.applicationServerKey
  } catch {
    return true
  }
  if (!actual) return true

  const a = new Uint8Array(actual)
  if (a.length !== expected.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== expected[i]) return false
  }
  return true
}

/** Our one and only service worker script. */
const OWN_SW_PATH = "/sw.js"

/**
 * Unregister every service worker on this origin except our own.
 *
 * Best-effort: a browser that refuses (or has no registrations) just
 * leaves things as they are — subscribing still proceeds.
 */
async function removeForeignServiceWorkers(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (r) => {
        const script =
          r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ""
        if (!script) return
        let path = script
        try {
          path = new URL(script).pathname
        } catch {
          /* keep the raw value */
        }
        if (path === OWN_SW_PATH) return
        try {
          await r.unregister()
        } catch {
          /* ignore — nothing we can do from here */
        }
      })
    )
  } catch {
    /* getRegistrations unavailable — nothing to clean */
  }
}

export type SubscribeOptions = {
  vapidPublicKey: string
  customerId?: string | null
}

export type SubscribeResult =
  | { status: "subscribed"; endpoint: string }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error"; error: string }

export async function subscribeToPush({
  vapidPublicKey,
  customerId,
}: SubscribeOptions): Promise<SubscribeResult> {
  if (!isPushSupported()) return { status: "unsupported" }

  try {
    // 1. Register the service worker.
    //
    // First evict any OTHER worker registered on this origin. Only one
    // service worker can control a scope, and a push subscription belongs
    // to whichever registration created it — so a second push script (the
    // site briefly shipped a third-party one at /firebase-messaging-sw.js)
    // silently takes ownership of the subscription and our own messages
    // are never delivered. Removing strays here makes a previously broken
    // device recover on its next visit.
    await removeForeignServiceWorkers()

    let reg: ServiceWorkerRegistration
    try {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    } catch (e: any) {
      return { status: "error", error: "service worker register failed: " + (e?.message || "") }
    }

    // 2. Request permission (no-op if already granted)
    const perm = await Notification.requestPermission()
    if (perm !== "granted") {
      return { status: "denied" }
    }

    // 3. Create the push subscription.
    //
    // A PushSubscription is permanently bound to the VAPID public key it
    // was created with: the push service will only accept messages signed
    // by the matching private key. So an EXISTING subscription cannot be
    // reused blindly — if it was created under a different key (a second
    // push script on the page, or our own keys having been rotated), every
    // message we send to it is rejected and the user silently receives
    // nothing, even though the row looks healthy in our database.
    //
    // Compare the stored key with ours and, on a mismatch, drop the old
    // subscription and take a fresh one. This self-heals affected devices
    // on their next visit instead of requiring the user to clear site data.
    const wantedKey = urlBase64ToUint8Array(vapidPublicKey)

    let pushSub = await reg.pushManager.getSubscription()
    if (pushSub && !subscriptionUsesKey(pushSub, wantedKey)) {
      try {
        await pushSub.unsubscribe()
      } catch {
        /* if it refuses to unsubscribe, subscribe() below will surface it */
      }
      pushSub = null
    }

    if (!pushSub) {
      pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // `as BufferSource` — TS models Uint8Array as generic over its
        // buffer type, which no longer matches the DOM's BufferSource
        // union once the value is held in a const.
        applicationServerKey: wantedKey as BufferSource,
      })
    }

    const json = pushSub.toJSON() as any
    const endpoint = json.endpoint as string
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth

    if (!endpoint || !p256dh || !auth) {
      return { status: "error", error: "missing keys on PushSubscription" }
    }

    // 4. POST to backend — geo is resolved server-side from the request IP.
    //    We attach the things only the browser knows: timezone, locale,
    //    and the page where the subscribe gesture happened.
    let timezone: string | null = null
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
    } catch {}
    const locale =
      typeof navigator !== "undefined" ? navigator.language || null : null
    const subscribeSource =
      typeof window !== "undefined"
        ? (window.location.pathname + window.location.search).slice(0, 255)
        : null

    const r = await postSubscription({
      endpoint,
      keys: { p256dh, auth },
      customer_id: customerId || null,
      locale,
      timezone,
      subscribe_source: subscribeSource,
    })
    if (!r.ok) {
      return { status: "error", error: "backend rejected subscription" }
    }

    // Mark in localStorage so we don't re-prompt
    try {
      localStorage.setItem("push:subscribed", "1")
      localStorage.setItem("push:endpoint", endpoint)
    } catch {}

    return { status: "subscribed", endpoint }
  } catch (e: any) {
    return { status: "error", error: e?.message || "unknown error" }
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration("/")
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return true
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await deleteSubscription(endpoint)
    try {
      localStorage.removeItem("push:subscribed")
      localStorage.removeItem("push:endpoint")
    } catch {}
    return true
  } catch {
    return false
  }
}

export async function syncCurrentSubscription(
  customerId?: string | null
): Promise<void> {
  // Re-POSTs the current subscription. Useful after login so the
  // anonymous subscription gets linked to the customer record. The
  // backend re-resolves geo from the request IP on every POST, so
  // the city/state row stays fresh whenever the user moves networks.
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration("/")
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const json = sub.toJSON() as any
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return
    let timezone: string | null = null
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
    } catch {}
    const locale =
      typeof navigator !== "undefined" ? navigator.language || null : null
    const subscribeSource =
      typeof window !== "undefined"
        ? (window.location.pathname + window.location.search).slice(0, 255)
        : null
    await postSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      customer_id: customerId || null,
      locale,
      timezone,
      subscribe_source: subscribeSource,
    })
  } catch {}
}
