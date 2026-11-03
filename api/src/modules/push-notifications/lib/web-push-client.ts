/**
 * Thin wrapper around the `web-push` npm package.
 *
 * Centralizes VAPID setup so every code path (subscribers, admin
 * campaign sender) uses the same configured client. Reads VAPID keys
 * from env at first use.
 *
 * To generate keys:
 *   npx web-push generate-vapid-keys
 *
 * Then add to `.env`:
 *   VAPID_PUBLIC_KEY=<public>
 *   VAPID_PRIVATE_KEY=<private>
 *   VAPID_SUBJECT=mailto:admin@example.com
 *
 * The same `VAPID_PUBLIC_KEY` must also be exposed to the storefront
 * as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` so the SW can subscribe.
 */

let _wp: any = null
let _configured = false

function getWebPush(): any {
  if (_wp) return _wp
  // Lazy require so the module loads even when web-push isn't installed yet
  // (during initial install or in test environments).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _wp = require("web-push")
  return _wp
}

/**
 * Configure the VAPID details on first call. Idempotent.
 */
export function configureWebPush(): {
  configured: boolean
  publicKey: string
  privateKey: string
  subject: string
} {
  const publicKey = process.env.VAPID_PUBLIC_KEY || ""
  const privateKey = process.env.VAPID_PRIVATE_KEY || ""
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com"

  if (!publicKey || !privateKey) {
    return { configured: false, publicKey, privateKey, subject }
  }

  if (!_configured) {
    try {
      getWebPush().setVapidDetails(subject, publicKey, privateKey)
      _configured = true
    } catch (e) {
      // Bad keys; surface a clear error at send time
      _configured = false
    }
  }

  return { configured: _configured, publicKey, privateKey, subject }
}

export type PushPayload = {
  title: string
  body: string
  icon?: string
  image?: string
  url?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
}

export type PushSubscriptionLite = {
  id?: string
  endpoint: string
  p256dh: string
  auth: string
  /** Passed through untouched so callers can attribute deliveries. */
  customer_id?: string | null
}

/**
 * What the push service's response means for the subscription.
 *
 *   ok        — accepted (2xx)
 *   expired   — 404/410: endpoint is gone for good → delete the row
 *   invalid   — 400/403/413: the push service will NEVER accept this
 *               pairing. Overwhelmingly this is a VAPID key mismatch
 *               (the subscription was created against a different
 *               public key than we now sign with) or a corrupt
 *               p256dh/auth. Retrying is pointless → deactivate.
 *   retryable — 408/429/5xx: the service is throttling or briefly down.
 *               Worth another attempt, and worth keeping the subscriber.
 *
 * This distinction is the whole ballgame: the old code only recognised
 * 404/410, so every `invalid` subscription stayed active and failed
 * again on EVERY future campaign. That is what makes a healthy list
 * slowly rot until "more than half" of each send reports failure.
 */
export type FailureKind = "expired" | "invalid" | "retryable"

export function classifyStatus(statusCode?: number): FailureKind {
  if (statusCode === 404 || statusCode === 410) return "expired"
  if (statusCode === 400 || statusCode === 403 || statusCode === 413)
    return "invalid"
  return "retryable"
}

export type SendResult = {
  success: boolean
  /** HTTP status code from the push service (when reachable) */
  statusCode?: number
  /** True when the subscription is permanently dead (410 Gone or 404). */
  expired?: boolean
  /** Permanently rejected (bad keys / VAPID mismatch) — deactivate it. */
  invalid?: boolean
  /** How the failure should be treated. Absent on success. */
  kind?: FailureKind
  /** Attempts actually made (1 unless a retryable error was retried). */
  attempts?: number
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Send a single notification. Always resolves — never throws — so callers
 * can fan out a batch send without try/catch noise.
 *
 * Retryable failures (throttling / transient 5xx) are retried with
 * exponential backoff, honouring `Retry-After` when the push service
 * sends one. Without this, a large campaign trips FCM's rate limiter and
 * the throttled recipients get permanently recorded as "failed" even
 * though nothing was wrong with them.
 */
export async function sendPushTo(
  sub: PushSubscriptionLite,
  payload: PushPayload,
  opts?: { maxAttempts?: number }
): Promise<SendResult> {
  const cfg = configureWebPush()
  if (!cfg.configured) {
    return {
      success: false,
      kind: "retryable",
      attempts: 0,
      error: "VAPID keys not configured",
    }
  }

  const wp = getWebPush()
  const subscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  const body = JSON.stringify(payload)
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 3)

  let last: SendResult = { success: false, kind: "retryable", error: "no attempt" }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await wp.sendNotification(subscription, body, {
        TTL: 60 * 60 * 24, // 24h — push services can hold the notification this long
        // `high` urgency tells FCM/APNs to wake the device and deliver
        // IMMEDIATELY instead of batching it for a later Doze/maintenance
        // window — critical for "instant" new-order alerts on Android.
        urgency: "high",
      })
      return { success: true, statusCode: res?.statusCode, attempts: attempt }
    } catch (err: any) {
      const statusCode = err?.statusCode
      const kind = classifyStatus(statusCode)
      last = {
        success: false,
        statusCode,
        kind,
        expired: kind === "expired",
        invalid: kind === "invalid",
        attempts: attempt,
        error: err?.body || err?.message || "send failed",
      }

      // Dead or permanently rejected → retrying cannot help.
      if (kind !== "retryable" || attempt === maxAttempts) return last

      // Respect Retry-After (seconds) when the service supplies one,
      // otherwise back off 500ms → 1s → 2s with a little jitter so a
      // whole batch doesn't retry in lockstep.
      const retryAfter = Number(
        err?.headers?.["retry-after"] ?? err?.headers?.["Retry-After"]
      )
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : 500 * 2 ** (attempt - 1) + Math.random() * 250
      await sleep(backoff)
    }
  }

  return last
}

export type BatchRecipientResult = {
  sub: PushSubscriptionLite
  result: SendResult
}

export type BatchOutcome = {
  total: number
  sent: number
  failed: number
  /** 404/410 — delete these subscriptions. */
  expiredIds: string[]
  /** 400/403/413 — deactivate these (keep the row, stop sending). */
  invalidIds: string[]
  /** Subscriptions that succeeded — stamp `last_sent_at`. */
  sentIds: string[]
  /** Per-recipient outcome, for writing the delivery log. */
  results: BatchRecipientResult[]
  /** Failure census keyed by "<kind>:<statusCode>" for diagnostics. */
  failureBreakdown: Record<string, number>
}

/**
 * Fan-out send. Returns aggregate stats, per-recipient results, and the
 * subscription IDs the caller should prune (dead) or deactivate
 * (permanently rejected) so the list self-heals instead of rotting.
 */
export async function sendPushBatch(
  subs: PushSubscriptionLite[],
  payload: PushPayload,
  concurrency = 20
): Promise<BatchOutcome> {
  const expiredIds: string[] = []
  const invalidIds: string[] = []
  const sentIds: string[] = []
  const results: BatchRecipientResult[] = []
  const failureBreakdown: Record<string, number> = {}
  let sent = 0
  let failed = 0

  // Simple concurrency-limited fan-out
  let cursor = 0
  async function worker() {
    while (cursor < subs.length) {
      const i = cursor++
      const sub = subs[i]
      const r = await sendPushTo(sub, payload)
      results.push({ sub, result: r })

      if (r.success) {
        sent++
        if (sub.id) sentIds.push(sub.id)
      } else {
        failed++
        const key = `${r.kind || "retryable"}:${r.statusCode ?? "none"}`
        failureBreakdown[key] = (failureBreakdown[key] || 0) + 1
        if (sub.id) {
          if (r.kind === "expired") expiredIds.push(sub.id)
          else if (r.kind === "invalid") invalidIds.push(sub.id)
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, subs.length) }, worker))

  return {
    total: subs.length,
    sent,
    failed,
    expiredIds,
    invalidIds,
    sentIds,
    results,
    failureBreakdown,
  }
}
