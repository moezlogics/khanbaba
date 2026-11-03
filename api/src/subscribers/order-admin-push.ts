import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { formatMoney, notifyAdmins } from "../modules/push-notifications/lib/admin-notify"

/**
 * ADMIN push on a new order.
 *
 * Runs in MEDUSA_WORKER_MODE = shared | worker (this server runs shared).
 * Delivery and logging live in `notifyAdmins`; this file only builds the
 * message.
 */

// Printed once when Medusa loads subscribers at startup. If this line is
// missing from logs/medusa-out.log after a restart, the build on the
// server doesn't contain this file.
console.log("[AdminPush] ✅ MODULE LOADED — subscriber registered for order.placed")

export default async function orderAdminPushHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data?.id
  console.log(`[AdminPush] 🔔 order.placed FIRED — orderId=${orderId || "NONE"}`)
  if (!orderId) return

  // Enrich the notification so the admin can triage from the lock screen.
  // Any lookup failure falls back to a generic message — the push itself
  // matters more than the details.
  let title = "🛒 New order received"
  let body = "A new order just came in — tap to view."
  try {
    const query = container.resolve("query") as any
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "total",
        "currency_code",
        "email",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "items.title",
        "items.quantity",
      ],
      filters: { id: orderId },
    })

    if (order) {
      const name = [order.shipping_address?.first_name, order.shipping_address?.last_name]
        .filter(Boolean)
        .join(" ")
      const total = formatMoney(order.total, order.currency_code)
      const items = order.items || []
      const firstItem = items[0]?.title
      const more = items.length > 1 ? ` +${items.length - 1} more` : ""

      title = `🛒 New order${order.display_id ? ` #${order.display_id}` : ""}${total ? ` · ${total}` : ""}`
      body = [name || order.email, firstItem ? `${firstItem}${more}` : null]
        .filter(Boolean)
        .join(" — ") || body
    }
  } catch (e: any) {
    console.log(`[AdminPush] order ${orderId}: details lookup failed (${e?.message || e}) — sending generic`)
  }

  await notifyAdmins(
    container,
    {
      title,
      body,
      url: `/orders/${orderId}`,
      tag: `admin-order-${orderId}`,
      data: { order_id: orderId, kind: "order.placed" },
    },
    `order.placed ${orderId}`
  )
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
