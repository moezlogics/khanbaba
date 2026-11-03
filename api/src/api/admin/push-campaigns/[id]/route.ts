import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PUSH_NOTIFICATIONS_MODULE } from "../../../../modules/push-notifications"
import PushNotificationsService from "../../../../modules/push-notifications/service"

/**
 * GET /admin/push-campaigns/:id
 *
 * Campaign detail backed by the per-recipient delivery log — the answer
 * to "who actually got this and why did the rest fail".
 *
 * Returns:
 *   campaign      the campaign row
 *   stats         accepted / shown / clicked / failed, computed from the
 *                 delivery rows rather than the cached counters
 *   failures      breakdown by status + status_code, with a plain-English
 *                 reason and a sample error body per bucket
 *   recipients    optional page of delivery rows (?include_recipients=1)
 *
 * Query: ?status=sent|failed|expired|invalid  ?limit=  ?offset=
 */

const REASONS: Record<string, string> = {
  expired:
    "Subscription is gone (browser data cleared, app uninstalled, or the endpoint expired). These are deleted automatically.",
  invalid:
    "The push service permanently rejected this subscription. Almost always a VAPID key mismatch — the subscriber signed up under a different VAPID key pair than the server signs with now, so it can never be delivered. These are deactivated automatically; the subscriber must re-subscribe.",
  failed:
    "Temporary failure (throttling or the push service was briefly unavailable). Already retried up to 3× during the send; these subscribers stay active and will be retried on the next campaign.",
  sent: "Accepted by the push service.",
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: PushNotificationsService = req.scope.resolve(
    PUSH_NOTIFICATIONS_MODULE
  )
  const { id } = req.params
  const q = req.query as Record<string, any>

  const campaign = await (svc as any).retrievePushCampaign(id).catch(() => null)
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" })
  }

  // The delivery log is the source of truth for this campaign's outcome.
  const deliveries = await (svc as any).listPushDeliveries(
    { campaign_id: id },
    { take: 100_000 }
  )

  const stats = {
    total: deliveries.length,
    accepted: 0, // handed to the push service successfully
    shown: 0, // confirmed displayed on the device
    clicked: 0,
    failed: 0, // transient
    expired: 0, // pruned
    invalid: 0, // deactivated
  }

  const buckets: Record<
    string,
    { status: string; status_code: number | null; count: number; reason: string; sample_error?: string }
  > = {}

  for (const d of deliveries) {
    if (d.status === "sent") stats.accepted++
    else if (d.status === "failed") stats.failed++
    else if (d.status === "expired") stats.expired++
    else if (d.status === "invalid") stats.invalid++

    if (d.shown_at) stats.shown++
    if (d.clicked_at) stats.clicked++

    if (d.status !== "sent") {
      const key = `${d.status}:${d.status_code ?? "none"}`
      if (!buckets[key]) {
        buckets[key] = {
          status: d.status,
          status_code: d.status_code ?? null,
          count: 0,
          reason: REASONS[d.status] || "Unknown failure.",
          sample_error: d.error || undefined,
        }
      }
      buckets[key].count++
    }
  }

  const denominator = stats.accepted || 1
  const rates = {
    // Delivery confirmation is best-effort (the SW callback can be dropped
    // when the device is offline), so treat this as a floor, not a ceiling.
    shown_rate: +((stats.shown / denominator) * 100).toFixed(1),
    click_rate: +((stats.clicked / denominator) * 100).toFixed(1),
    failure_rate: stats.total
      ? +(((stats.total - stats.accepted) / stats.total) * 100).toFixed(1)
      : 0,
  }

  const payload: Record<string, any> = {
    campaign,
    stats,
    rates,
    failures: Object.values(buckets).sort((a, b) => b.count - a.count),
  }

  if (q.include_recipients === "1" || q.include_recipients === "true") {
    const limit = Math.min(parseInt(q.limit || "100", 10), 1000)
    const offset = parseInt(q.offset || "0", 10)
    let rows = deliveries
    if (q.status) rows = rows.filter((d: any) => d.status === q.status)
    payload.recipients = rows.slice(offset, offset + limit)
    payload.recipients_count = rows.length
  }

  res.json(payload)
}
