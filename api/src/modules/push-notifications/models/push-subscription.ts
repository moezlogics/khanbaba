import { model } from "@medusajs/framework/utils"

/**
 * Web Push subscription. One row per browser/device that has granted
 * notification permission. Keyed by `endpoint` (the unique URL the push
 * service issues for that browser).
 *
 * `customer_id` links the subscription to a logged-in customer so we can
 * target order-specific transactional pushes. Anonymous visitors still
 * subscribe — those rows have `customer_id = null` and only receive
 * marketing campaigns.
 */
export const PushSubscription = model.define("push_subscription", {
  id: model.id({ prefix: "psub" }).primaryKey(),
  endpoint: model.text().unique(),
  p256dh: model.text(),
  auth: model.text(),
  customer_id: model.text().nullable(),
  // Geo (resolved from IP at subscribe time)
  city: model.text().nullable(),
  state: model.text().nullable(),
  country: model.text().nullable(),
  // Browser fingerprint for the dashboard
  user_agent: model.text().nullable(),
  device_browser: model.text().nullable(),
  // Marketer-grade segmentation data captured on subscribe
  device_type: model.text().nullable(), // mobile / tablet / desktop
  os: model.text().nullable(), // Android / iOS / Windows / macOS / Linux / Other
  locale: model.text().nullable(), // e.g. en-US, ur-PK
  timezone: model.text().nullable(), // e.g. Asia/Karachi
  subscribe_source: model.text().nullable(), // path where they subscribed (e.g. /pk/products/foo)
  is_active: model.boolean().default(true),
  // Customer-supplied demographic. Populated either at subscribe time
  // (legacy flow — we didn't ask then) or, more commonly, synced from
  // the customer's profile once they finish the onboarding wizard.
  // Stored as free text (not an enum) so we can accept future values
  // ("other", "prefer_not_to_say", etc.) without another migration.
  gender: model.text().nullable(),
  // Tracks last successful send so we can prune dead endpoints
  last_sent_at: model.dateTime().nullable(),
  // Engagement — populated by the SW click callback. Used for CTR
  // segmentation ("hot" vs "dormant" subscribers).
  total_clicked: model.number().default(0),
  last_clicked_at: model.dateTime().nullable(),
  total_shown: model.number().default(0),
  last_shown_at: model.dateTime().nullable(),
})

/**
 * Manual marketing campaigns. Each campaign keeps its own copy of the
 * payload (title/body/icon/image/url) so the dashboard can show a
 * permanent send history with stats.
 */
export const PushCampaign = model.define("push_campaign", {
  id: model.id({ prefix: "pcamp" }).primaryKey(),
  title: model.text(),
  body: model.text(),
  icon_url: model.text().nullable(),
  image_url: model.text().nullable(),
  action_url: model.text().nullable(),
  // Audience filters — JSON-stringified arrays of cities/states.
  // Empty / null = send to everyone.
  filter_cities: model.text().nullable(),
  filter_states: model.text().nullable(),
  filter_countries: model.text().nullable(),
  filter_device_types: model.text().nullable(), // JSON: ["mobile","desktop"]
  filter_os: model.text().nullable(), // JSON: ["Android","iOS"]
  filter_browsers: model.text().nullable(), // JSON: ["Chrome","Safari"]
  filter_genders: model.text().nullable(), // JSON: ["male","female"]
  filter_customers_only: model.boolean().default(false),
  // Stats
  total_targeted: model.number().default(0),
  total_sent: model.number().default(0),
  total_failed: model.number().default(0),
  total_clicked: model.number().default(0),
  total_shown: model.number().default(0),
  status: model.enum(["draft", "sending", "sent", "failed"]).default("draft"),
  sent_at: model.dateTime().nullable(),
})

/**
 * Per-recipient delivery record — one row per (campaign, subscription).
 *
 * WHY THIS EXISTS: campaigns used to keep only aggregate counters
 * (total_sent / total_failed), so when a send went badly there was no way
 * to answer the two questions that actually matter — *who* got it, and
 * *why* the rest didn't. Every failure looked identical, and permanently
 * broken endpoints were retried on every future campaign because nothing
 * recorded that they were hopeless.
 *
 * `status` is the outcome of the push-service handoff:
 *   sent    — the push service accepted it (201)
 *   failed  — transient/unknown error, worth retrying next time
 *   expired — endpoint is permanently gone (404/410); subscription pruned
 *   invalid — permanently rejected (400/403/413), usually a VAPID-key
 *             mismatch; the subscription is deactivated, not deleted, so
 *             the row stays auditable
 *
 * `shown_at` / `clicked_at` are stamped by the service-worker callbacks,
 * which turns "we handed it to FCM" into real delivery confirmation.
 */
export const PushDelivery = model.define("push_delivery", {
  id: model.id({ prefix: "pdlv" }).primaryKey(),
  campaign_id: model.text(),
  subscription_id: model.text().nullable(),
  // Denormalised so the SW callbacks (which only know the endpoint) can
  // find the row without a join back through the subscription table.
  endpoint: model.text(),
  customer_id: model.text().nullable(),
  status: model.enum(["sent", "failed", "expired", "invalid"]).default("sent"),
  status_code: model.number().nullable(),
  error: model.text().nullable(),
  attempts: model.number().default(1),
  shown_at: model.dateTime().nullable(),
  clicked_at: model.dateTime().nullable(),
})

