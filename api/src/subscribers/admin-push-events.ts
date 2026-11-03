import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { formatMoney, notifyAdmins } from "../modules/push-notifications/lib/admin-notify"

/**
 * ADMIN push for store activity other than new orders (see
 * order-admin-push.ts for those).
 *
 *   order.canceled   — an order was canceled
 *   customer.created — someone created an account
 *   contact.created  — a message came in through the contact form
 *
 * These event names are the same ones the existing subscribers in this
 * folder already listen to in production. `order.updated` is deliberately
 * NOT included: it fires on every small change and would bury the useful
 * alerts.
 */

console.log("[AdminPush] ✅ MODULE LOADED — admin events: order.canceled, customer.created, contact.created")

type EventData = {
  id?: string
  // contact.created payload
  name?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
}

export default async function adminPushEventsHandler({
  event: { name, data },
  container,
}: SubscriberArgs<EventData>) {
  console.log(`[AdminPush] 🔔 ${name} FIRED — id=${data?.id || "-"}`)

  const query = safeResolve(container, "query")

  if (name === "order.canceled" && data?.id) {
    let title = "❌ Order canceled"
    let body = "An order was canceled — tap to view."
    try {
      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "total", "currency_code", "email", "shipping_address.first_name", "shipping_address.last_name"],
        filters: { id: data.id },
      })
      if (order) {
        const who = [order.shipping_address?.first_name, order.shipping_address?.last_name]
          .filter(Boolean)
          .join(" ") || order.email
        const total = formatMoney(order.total, order.currency_code)
        title = `❌ Order${order.display_id ? ` #${order.display_id}` : ""} canceled`
        body = [who, total].filter(Boolean).join(" — ") || body
      }
    } catch {
      /* generic message */
    }

    await notifyAdmins(
      container,
      { title, body, url: `/orders/${data.id}`, tag: `admin-order-canceled-${data.id}`, data: { order_id: data.id, kind: name } },
      `order.canceled ${data.id}`
    )
    return
  }

  if (name === "customer.created" && data?.id) {
    let body = "A new customer just signed up."
    try {
      const {
        data: [customer],
      } = await query.graph({
        entity: "customer",
        fields: ["id", "first_name", "last_name", "email", "phone"],
        filters: { id: data.id },
      })
      if (customer) {
        const full = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
        body = [full, customer.email || customer.phone].filter(Boolean).join(" — ") || body
      }
    } catch {
      /* generic message */
    }

    await notifyAdmins(
      container,
      { title: "👤 New customer", body, url: "/dashboard", tag: `admin-customer-${data.id}`, data: { kind: name } },
      `customer.created ${data.id}`
    )
    return
  }

  if (name === "contact.created") {
    const from = data?.name || data?.email || "Someone"
    const subject = data?.subject ? `: ${data.subject}` : ""
    const snippet = (data?.message || "").replace(/\s+/g, " ").trim().slice(0, 120)

    await notifyAdmins(
      container,
      {
        title: `✉️ New message from ${from}${subject}`.slice(0, 90),
        body: snippet || [data?.email, data?.phone].filter(Boolean).join(" · ") || "Open to read it.",
        url: "/dashboard",
        // Unique per message so several contact messages don't collapse
        // into a single notification.
        tag: `admin-contact-${Date.now()}`,
        data: { kind: name },
      },
      "contact.created"
    )
  }
}

function safeResolve(container: any, key: string): any {
  try {
    return container.resolve(key)
  } catch {
    return { graph: async () => ({ data: [] }) }
  }
}

export const config: SubscriberConfig = {
  event: ["order.canceled", "customer.created", "contact.created"],
}
