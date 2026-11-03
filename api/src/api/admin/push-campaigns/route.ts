import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PUSH_NOTIFICATIONS_MODULE } from "../../../modules/push-notifications"
import PushNotificationsService from "../../../modules/push-notifications/service"
import {
  configureWebPush,
  sendPushBatch,
} from "../../../modules/push-notifications/lib/web-push-client"

/**
 * GET /admin/push-campaigns
 *   List campaign history (newest first) — drives the dashboard table.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: PushNotificationsService = req.scope.resolve(
    PUSH_NOTIFICATIONS_MODULE
  )
  const [campaigns, count] = await (svc as any).listAndCountPushCampaigns(
    {},
    { order: { created_at: "DESC" } as any, take: 100 }
  )
  res.json({ campaigns, count })
}

/**
 * POST /admin/push-campaigns
 *   Create + send a campaign in one shot. Filters are applied to pick
 *   the active subscriber set, then `web-push` fans out the payload.
 *
 * Body:
 *   {
 *     title:        string,
 *     body:         string,
 *     icon_url?:    string,    // small icon (96x96 or 192x192)
 *     image_url?:   string,    // rich media banner
 *     action_url?:  string,    // where the click goes
 *     filter_cities?:  string[],
 *     filter_states?:  string[],
 *     dry_run?: boolean
 *   }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc: PushNotificationsService = req.scope.resolve(
    PUSH_NOTIFICATIONS_MODULE
  )
  const logger = req.scope.resolve("logger") as any

  const body = (req.body || {}) as Record<string, any>
  const title = (body.title || "").toString().trim()
  const bodyText = (body.body || "").toString().trim()
  if (!title) return res.status(400).json({ error: "title is required" })
  if (!bodyText) return res.status(400).json({ error: "body is required" })

  const cfg = configureWebPush()
  if (!cfg.configured) {
    return res.status(503).json({
      error:
        "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the backend .env (run `npx web-push generate-vapid-keys`).",
    })
  }

  const toList = (v: any): string[] | null =>
    Array.isArray(v) ? v.filter(Boolean).map(String) : null

  const filterCities = toList(body.filter_cities)
  const filterStates = toList(body.filter_states)
  const filterCountries = toList(body.filter_countries)
  const filterDeviceTypes = toList(body.filter_device_types)
  const filterOs = toList(body.filter_os)
  const filterBrowsers = toList(body.filter_browsers)
  const filterGenders = toList(body.filter_genders)
  const customersOnly = body.filter_customers_only === true

  // Find target subscribers
  const filter: Record<string, any> = { is_active: true }
  // We can't combine OR filters easily through the service, so we fetch
  // all active subscribers and filter in-memory (typical campaign sets
  // are < 100k; suitable for a single Node process). For production
  // scale this should be a worker queue + DB-side filtering.
  const all = await (svc as any).listPushSubscriptions(filter, {
    take: 100_000,
  })

  const matchOneOf = (val: any, list: string[] | null) => {
    if (!list || list.length === 0) return true
    if (!val) return false
    const set = new Set(list.map((c) => c.toLowerCase()))
    return set.has(String(val).toLowerCase())
  }

  let targets = all.filter((s: any) => {
    if (!matchOneOf(s.city, filterCities)) return false
    if (!matchOneOf(s.state, filterStates)) return false
    if (!matchOneOf(s.country, filterCountries)) return false
    if (!matchOneOf(s.device_type, filterDeviceTypes)) return false
    if (!matchOneOf(s.os, filterOs)) return false
    if (!matchOneOf(s.device_browser, filterBrowsers)) return false
    if (!matchOneOf(s.gender, filterGenders)) return false
    if (customersOnly && !s.customer_id) return false
    return true
  })

  if (body.dry_run) {
    return res.json({
      success: true,
      dry_run: true,
      total_targeted: targets.length,
    })
  }

  // Persist the campaign first so we have an ID for the audit log
  const [campaign] = await (svc as any).createPushCampaigns([
    {
      title,
      body: bodyText,
      icon_url: body.icon_url ? String(body.icon_url) : null,
      image_url: body.image_url ? String(body.image_url) : null,
      action_url: body.action_url ? String(body.action_url) : null,
      filter_cities: filterCities ? JSON.stringify(filterCities) : null,
      filter_states: filterStates ? JSON.stringify(filterStates) : null,
      filter_countries: filterCountries ? JSON.stringify(filterCountries) : null,
      filter_device_types: filterDeviceTypes
        ? JSON.stringify(filterDeviceTypes)
        : null,
      filter_os: filterOs ? JSON.stringify(filterOs) : null,
      filter_browsers: filterBrowsers ? JSON.stringify(filterBrowsers) : null,
      filter_genders: filterGenders ? JSON.stringify(filterGenders) : null,
      filter_customers_only: customersOnly,
      total_targeted: targets.length,
      total_sent: 0,
      total_failed: 0,
      status: "sending",
    },
  ])

  // Find a publishable API key from the database if not set in environment
  let publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY || process.env.STORE_PUBLISHABLE_KEY
  if (!publishableKey) {
    try {
      const query = req.scope.resolve("query")
      const { data: apiKeys } = await query.graph({
        entity: "api_key",
        fields: ["id", "type"],
        filters: {
          type: "publishable",
        },
      })
      if (apiKeys && apiKeys.length > 0) {
        publishableKey = apiKeys[0].id
      }
    } catch (err) {
      logger?.warn?.(`[PushCampaign] Failed to query publishable API key: ${(err as Error).message}`)
    }
  }

  // Build the payload the SW will receive. We thread the backend URL
  // and publishable key through so the SW can post click events back
  // for CTR tracking. (See `public/sw.js` `trackClick`.)
  const payload: any = {
    title,
    body: bodyText,
    icon: body.icon_url || undefined,
    image: body.image_url || undefined,
    url: body.action_url || "/",
    tag: `campaign-${campaign.id}`,
    backend_url:
      process.env.STORE_PUBLIC_BACKEND_URL ||
      process.env.MEDUSA_BACKEND_URL ||
      undefined,
    publishable_key: publishableKey || undefined,
    data: { campaign_id: campaign.id },
  }


  // Everything needed by the background job is resolved NOW, while the
  // request scope is alive, and handed over explicitly.
  let pg: any = null
  try {
    pg = req.scope.resolve("__pg_connection__")
  } catch {
    /* bulk updates fall back to the ORM */
  }

  const recipients = targets.map((t: any) => ({
    id: t.id,
    endpoint: t.endpoint,
    p256dh: t.p256dh,
    auth: t.auth,
    // Carried through only so the delivery log can attribute the send to
    // a customer; the push client itself ignores it.
    customer_id: t.customer_id || null,
  }))

  // ── Respond immediately, send in the background ────────────────────
  // Sending to ~20k subscribers takes minutes (a network round-trip per
  // recipient, plus retries and bookkeeping). Doing it inside this request
  // meant nginx/Cloudflare cut the connection long before it finished, so
  // the admin saw a failure and the campaign never reached a final state.
  // The campaign row is already persisted with status "sending"; the
  // history table picks up the final numbers when the job completes.
  res.status(202).json({
    success: true,
    queued: true,
    campaign_id: campaign.id,
    total_targeted: recipients.length,
    status: "sending",
    message:
      "Campaign queued. Sending happens in the background - refresh the campaign history to see the result.",
  })

  runCampaign({ svc, logger, pg, campaign, recipients, payload }).catch(
    async (e: any) => {
      logger?.error?.(
        `[PushCampaign ${campaign.id}] background send crashed: ${e?.message || e}`
      )
      try {
        await (svc as any).updatePushCampaigns({
          id: campaign.id,
          status: "failed",
          sent_at: new Date(),
        })
      } catch {
        /* nothing more we can do */
      }
    }
  )
}

/** How many recipients to try before committing to the full send. */
const CANARY_SIZE = 25
/** Max ids per bulk UPDATE statement. */
const SQL_CHUNK = 5000

type Recipient = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  customer_id: string | null
}

async function runCampaign({
  svc,
  logger,
  pg,
  campaign,
  recipients,
  payload,
}: {
  svc: any
  logger: any
  pg: any
  campaign: any
  recipients: Recipient[]
  payload: any
}) {
  const started = Date.now()

  // ── Canary ─────────────────────────────────────────────────────────
  // Try a small slice first. If NOT ONE of them is accepted, the problem
  // is almost certainly systemic (VAPID credentials, JWT or server clock,
  // network) rather than 25 individually dead subscriptions, so stop
  // instead of hammering the push service tens of thousands of times.
  const canary = recipients.slice(0, CANARY_SIZE)
  const rest = recipients.slice(CANARY_SIZE)

  const first = await sendPushBatch(canary, payload)
  let result: any = first

  const canaryDead =
    first.total >= Math.min(CANARY_SIZE, recipients.length) && first.sent === 0

  if (canaryDead && rest.length > 0) {
    logger?.warn?.(
      `[PushCampaign ${campaign.id}] canary: 0/${first.total} accepted, aborting full send. ` +
        `breakdown=${JSON.stringify(first.failureBreakdown)}`
    )
  } else if (rest.length > 0) {
    const second = await sendPushBatch(rest, payload)
    result = mergeOutcomes(first, second)
  }

  const now = new Date()

  // ── Delivery log ───────────────────────────────────────────────────
  try {
    const rows = result.results.map(({ sub, result: r }: any) => ({
      campaign_id: campaign.id,
      subscription_id: sub.id || null,
      endpoint: sub.endpoint,
      customer_id: sub.customer_id || null,
      status: r.success
        ? "sent"
        : r.kind === "expired"
        ? "expired"
        : r.kind === "invalid"
        ? "invalid"
        : "failed",
      status_code: r.statusCode ?? null,
      // Truncated: some push services return a full HTML error page.
      error: r.success ? null : String(r.error || "").slice(0, 500) || null,
      attempts: r.attempts ?? 1,
    }))
    for (let i = 0; i < rows.length; i += 500) {
      await svc.createPushDeliveries(rows.slice(i, i + 500))
    }
  } catch (e: any) {
    logger?.warn?.(
      `[PushCampaign ${campaign.id}] delivery log write failed: ${e?.message || e}`
    )
  }

  // ── Subscriber bookkeeping, only when the channel provably works ────
  // A 403 means "rejected", but the push service returns it both for one
  // subscription made under another key AND for every request when our own
  // VAPID signature is bad. If nothing at all was delivered those two cases
  // look identical, and deactivating on that signal wipes a perfectly good
  // list, which is exactly how subscriber counts dropped after each send.
  // So pruning and deactivation only happen once at least one message was
  // accepted, which proves the credentials themselves are fine.
  const channelWorks = result.sent > 0

  if (result.sentIds.length > 0) {
    await bulkUpdate(pg, svc, logger, campaign.id, "last_sent_at", result.sentIds,
      `UPDATE push_subscription SET last_sent_at = ?, updated_at = now() WHERE id = ANY(?)`,
      (id: string) => ({ id, last_sent_at: now }),
      [now])
  }

  if (channelWorks && result.expiredIds.length > 0) {
    // Soft delete, matching Medusa's own deletePushSubscriptions.
    await bulkUpdate(pg, svc, logger, campaign.id, "prune expired", result.expiredIds,
      `UPDATE push_subscription SET deleted_at = now(), updated_at = now() WHERE id = ANY(?)`,
      null,
      [])
  }

  if (channelWorks && result.invalidIds.length > 0) {
    await bulkUpdate(pg, svc, logger, campaign.id, "deactivate invalid", result.invalidIds,
      `UPDATE push_subscription SET is_active = false, updated_at = now() WHERE id = ANY(?)`,
      (id: string) => ({ id, is_active: false }),
      [])
  }

  if (!channelWorks && recipients.length > 0) {
    logger?.warn?.(
      `[PushCampaign ${campaign.id}] 0 delivered, subscribers left untouched. ` +
        `This points to a server-side problem (VAPID keys or subject, server clock, ` +
        `network) rather than dead subscriptions. breakdown=${JSON.stringify(result.failureBreakdown)}`
    )
  }

  await svc.updatePushCampaigns({
    id: campaign.id,
    total_targeted: recipients.length,
    total_sent: result.sent,
    total_failed: recipients.length - result.sent,
    status: result.sent === 0 && recipients.length > 0 ? "failed" : "sent",
    sent_at: now,
  })

  logger?.info?.(
    `[PushCampaign ${campaign.id}] done in ${Math.round((Date.now() - started) / 1000)}s: ` +
      `targeted=${recipients.length} attempted=${result.total} sent=${result.sent} ` +
      `breakdown=${JSON.stringify(result.failureBreakdown)}`
  )
}

function mergeOutcomes(a: any, b: any) {
  const breakdown: Record<string, number> = { ...a.failureBreakdown }
  for (const [k, v] of Object.entries(b.failureBreakdown as Record<string, number>)) {
    breakdown[k] = (breakdown[k] || 0) + v
  }
  return {
    total: a.total + b.total,
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    expiredIds: [...a.expiredIds, ...b.expiredIds],
    invalidIds: [...a.invalidIds, ...b.invalidIds],
    sentIds: [...a.sentIds, ...b.sentIds],
    results: [...a.results, ...b.results],
    failureBreakdown: breakdown,
  }
}

/**
 * Update many subscription rows at once.
 *
 * One SQL statement per 5k ids instead of the ORM's per-row updates; with
 * tens of thousands of recipients the ORM path alone ran for minutes.
 * Falls back to the ORM when the raw connection is not available.
 */
async function bulkUpdate(
  pg: any,
  svc: any,
  logger: any,
  campaignId: string,
  label: string,
  ids: string[],
  sql: string,
  ormRow: ((id: string) => Record<string, any>) | null,
  leadingBindings: any[]
) {
  try {
    if (pg) {
      for (let i = 0; i < ids.length; i += SQL_CHUNK) {
        await pg.raw(sql, [...leadingBindings, ids.slice(i, i + SQL_CHUNK)])
      }
      return
    }
    if (ormRow) {
      await svc.updatePushSubscriptions(ids.map(ormRow))
    } else {
      await svc.deletePushSubscriptions(ids)
    }
  } catch (e: any) {
    logger?.warn?.(
      `[PushCampaign ${campaignId}] ${label} failed for ${ids.length} rows: ${e?.message || e}`
    )
  }
}
