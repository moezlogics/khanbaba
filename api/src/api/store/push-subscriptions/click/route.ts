import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PUSH_NOTIFICATIONS_MODULE } from "../../../../modules/push-notifications"
import PushNotificationsService from "../../../../modules/push-notifications/service"

/**
 * POST /store/push-subscriptions/click
 *
 * Fired by the service worker's `notificationclick` handler. Increments
 * the per-subscription click counter and the campaign's `total_clicked`
 * stat so the admin dashboard can report CTR.
 *
 * Body:
 *   {
 *     endpoint: string,    // unique identifier of the subscription
 *     campaign_id?: string // optional — only set for marketing pushes
 *   }
 *
 * Designed to be best-effort: never throws, always returns 200 even if
 * the subscription / campaign isn't found, because the SW retries are
 * not worth the noise.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc: PushNotificationsService = req.scope.resolve(
      PUSH_NOTIFICATIONS_MODULE
    )
    const body = (req.body || {}) as Record<string, any>
    const endpoint = (body.endpoint || "").toString().trim()
    const campaignId = body.campaign_id ? String(body.campaign_id) : null

    if (!endpoint) {
      return res.json({ success: true, ignored: true })
    }

    const now = new Date()

    // Bump per-subscription engagement
    const subs = await (svc as any).listPushSubscriptions({ endpoint })
    const sub = subs?.[0]
    if (sub) {
      await (svc as any).updatePushSubscriptions({
        id: sub.id,
        total_clicked: (sub.total_clicked || 0) + 1,
        last_clicked_at: now,
      })
    }

    // Stamp the per-recipient delivery row so CTR can be computed against
    // real recipients, not just an aggregate counter. A click also proves
    // the notification was shown, so backfill `shown_at` when the `shown`
    // callback never made it through (it fires from a short-lived SW
    // context and is easily dropped).
    if (campaignId) {
      try {
        const deliveries = await (svc as any).listPushDeliveries({
          campaign_id: campaignId,
          endpoint,
        })
        const delivery = deliveries?.[0]
        if (delivery) {
          const patch: Record<string, any> = { id: delivery.id }
          if (!delivery.clicked_at) patch.clicked_at = now
          if (!delivery.shown_at) patch.shown_at = now
          if (Object.keys(patch).length > 1) {
            await (svc as any).updatePushDeliveries(patch)
          }
        }
      } catch {
        // best-effort — never fail the SW callback
      }
    }

    // Bump campaign click stat
    if (campaignId) {
      try {
        const camps = await (svc as any).listPushCampaigns({ id: campaignId })
        const camp = camps?.[0]
        if (camp) {
          await (svc as any).updatePushCampaigns({
            id: camp.id,
            total_clicked: (camp.total_clicked || 0) + 1,
          })
        }
      } catch {
        // ignore — campaign may have been deleted
      }
    }

    res.json({ success: true })
  } catch {
    // Never fail the click handler — it would just spam the SW logs.
    res.json({ success: true })
  }
}
