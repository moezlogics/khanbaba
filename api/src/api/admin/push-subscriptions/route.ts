import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PUSH_NOTIFICATIONS_MODULE } from "../../../modules/push-notifications"
import PushNotificationsService from "../../../modules/push-notifications/service"

/**
 * GET /admin/push-subscriptions
 *   List subscribers with optional filters and a small stats summary
 *   used to power the dashboard chips.
 *
 * Query:
 *   ?city=Lahore       — filter by city
 *   ?state=Punjab      — filter by state
 *   ?browser=Chrome    — filter by device browser
 *   ?customers_only=1  — only logged-in customers
 *   ?take=100          — page size (default 100, max 500)
 *   ?skip=0            — offset
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: PushNotificationsService = req.scope.resolve(
    PUSH_NOTIFICATIONS_MODULE
  )

  const filter: Record<string, any> = { is_active: true }
  if (req.query.city) filter.city = req.query.city
  if (req.query.state) filter.state = req.query.state
  if (req.query.country) filter.country = req.query.country
  if (req.query.browser) filter.device_browser = req.query.browser
  if (req.query.device_type) filter.device_type = req.query.device_type
  if (req.query.os) filter.os = req.query.os
  if (req.query.gender) filter.gender = String(req.query.gender).toLowerCase()
  if (req.query.customers_only === "1") {
    // Filter out null customer_id — handled in JS below since MikroORM
    // operators need explicit `$ne` syntax on a different code path.
  }

  const take = Math.min(Number(req.query.take) || 100, 500)
  const skip = Number(req.query.skip) || 0

  const [rows, total] = await (svc as any).listAndCountPushSubscriptions(
    filter,
    { order: { created_at: "DESC" } as any, take, skip }
  )

  let subscribers = rows
  if (req.query.customers_only === "1") {
    subscribers = rows.filter((r: any) => !!r.customer_id)
  }

  const stats = await computeStats(req, svc)

  res.json({ subscribers, count: total, stats })
}

/**
 * Dashboard stats, counted IN THE DATABASE.
 *
 * This used to load the active subscribers with `take: 10_000` and count
 * them in JS — so "Total Active" silently maxed out at exactly 10,000 while
 * the list header (a real COUNT) showed 20,159. Nothing was lost; the
 * number was just capped. Aggregating in SQL is correct at any size and
 * doesn't pull every row across the wire on each dashboard load.
 *
 * Falls back to the old in-memory pass if raw SQL is unavailable, so a
 * connection hiccup degrades the numbers instead of breaking the page.
 */
async function computeStats(req: MedusaRequest, svc: any) {
  const where = "is_active = true AND deleted_at IS NULL"
  try {
    const pg: any = req.scope.resolve("__pg_connection__")
    const rows = (r: any) => (r?.rows ?? r ?? []) as any[]

    const [totals, cities, states, browsers, genders] = await Promise.all([
      pg.raw(
        `SELECT count(*)::int AS total, count(customer_id)::int AS with_customer
           FROM push_subscription WHERE ${where}`
      ),
      pg.raw(
        `SELECT city AS key, count(*)::int AS count FROM push_subscription
          WHERE ${where} AND city IS NOT NULL
          GROUP BY city ORDER BY count DESC LIMIT 20`
      ),
      pg.raw(
        `SELECT state AS key, count(*)::int AS count FROM push_subscription
          WHERE ${where} AND state IS NOT NULL
          GROUP BY state ORDER BY count DESC LIMIT 20`
      ),
      pg.raw(
        `SELECT device_browser AS key, count(*)::int AS count FROM push_subscription
          WHERE ${where} AND device_browser IS NOT NULL
          GROUP BY device_browser`
      ),
      pg.raw(
        `SELECT gender AS key, count(*)::int AS count FROM push_subscription
          WHERE ${where} AND gender IS NOT NULL
          GROUP BY gender`
      ),
    ])

    const t = rows(totals)[0] || { total: 0, with_customer: 0 }
    const toObj = (list: any[]) =>
      Object.fromEntries(list.map((x) => [x.key, Number(x.count)]))

    return {
      total_active: Number(t.total),
      with_customer: Number(t.with_customer),
      anonymous: Number(t.total) - Number(t.with_customer),
      by_city: rows(cities).map((x) => ({ key: x.key, count: Number(x.count) })),
      by_state: rows(states).map((x) => ({ key: x.key, count: Number(x.count) })),
      by_browser: toObj(rows(browsers)),
      by_gender: toObj(rows(genders)),
    }
  } catch {
    // Degraded fallback — same shape as before.
    const all = await svc.listPushSubscriptions(
      { is_active: true },
      { take: 10_000 }
    )
    const city: Record<string, number> = {}
    const state: Record<string, number> = {}
    const browser: Record<string, number> = {}
    const gender: Record<string, number> = {}
    let withCustomer = 0
    for (const x of all) {
      if (x.city) city[x.city] = (city[x.city] || 0) + 1
      if (x.state) state[x.state] = (state[x.state] || 0) + 1
      if (x.device_browser) browser[x.device_browser] = (browser[x.device_browser] || 0) + 1
      if (x.gender) gender[x.gender] = (gender[x.gender] || 0) + 1
      if (x.customer_id) withCustomer++
    }
    return {
      total_active: all.length,
      with_customer: withCustomer,
      anonymous: all.length - withCustomer,
      by_city: topN(city, 20),
      by_state: topN(state, 20),
      by_browser: browser,
      by_gender: gender,
    }
  }
}

function topN(obj: Record<string, number>, n: number) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }))
}
