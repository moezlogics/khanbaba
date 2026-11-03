import { configureWebPush, sendPushBatch, type PushPayload } from "./web-push-client"
import { PUSH_NOTIFICATIONS_MODULE } from "../index"

/**
 * Send a push to every registered admin device (the orders PWA).
 *
 * Shared by all admin-facing subscribers so each event only has to build
 * its payload. Never throws — a push failure must not break order
 * placement, cancellation, sign-up or the contact form that triggered it.
 *
 * Logs with console.log on purpose: the framework logger is filtered on
 * this server, and these `[AdminPush]` lines are how you confirm from
 * `logs/medusa-out.log` whether an event fired, how many devices were
 * found, and whether the push service accepted the message.
 */
export async function notifyAdmins(
  container: any,
  payload: PushPayload,
  label: string
): Promise<void> {
  try {
    const cfg = configureWebPush()
    if (!cfg.configured) {
      console.log(`[AdminPush] ⚠️ ${label}: VAPID keys not configured — skipped`)
      return
    }

    const svc: any = container.resolve(PUSH_NOTIFICATIONS_MODULE)

    let subs: any[] = []
    try {
      subs = await svc.listAdminPushSubscriptions({ is_active: true }, { take: 200 })
    } catch (e: any) {
      // Most common cause: the admin_push_subscription table was never
      // created on this database.
      console.log(
        `[AdminPush] ❌ ${label}: could not read admin devices — ${e?.message || e}`
      )
      return
    }

    console.log(`[AdminPush] ${label}: ${subs.length} admin device(s)`)
    if (!subs.length) return

    const result = await sendPushBatch(
      subs.map((s) => ({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      payload
    )

    // 404/410 always mean that one subscription is gone (unlike 403, which
    // can also mean our own keys are wrong), so these are safe to remove.
    if (result.expiredIds.length) {
      try {
        await svc.deleteAdminPushSubscriptions(result.expiredIds)
      } catch {
        /* ignore prune errors */
      }
    }

    console.log(
      `[AdminPush] 📤 ${label}: sent=${result.sent}/${result.total} failed=${result.failed} ` +
        `pruned=${result.expiredIds.length}` +
        (result.failed ? ` breakdown=${JSON.stringify(result.failureBreakdown)}` : "")
    )
  } catch (e: any) {
    console.log(`[AdminPush] ❌ ${label}: ${e?.message || e}`)
  }
}

/** Format a money amount for a notification line; never throws. */
export function formatMoney(amount: any, currency?: string | null): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return ""
  const code = (currency || "").toUpperCase()
  try {
    return new Intl.NumberFormat("en-PK", {
      style: code ? "currency" : "decimal",
      ...(code ? { currency: code } : {}),
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${code ? code + " " : ""}${Math.round(n).toLocaleString()}`
  }
}
