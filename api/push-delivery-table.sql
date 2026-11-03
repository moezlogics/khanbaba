-- ===================================================================
--  push_delivery — per-recipient delivery log for push campaigns
-- ===================================================================
--
--  Run ONCE per database (safe to re-run — IF NOT EXISTS everywhere):
--
--    sudo -u postgres psql -d khanbabadb     -f push-delivery-table.sql
--    sudo -u postgres psql -d mobilestorepkdb -f push-delivery-table.sql
--
--  Columns/types match the Medusa model in
--  src/modules/push-notifications/models/push-subscription.ts
--  (PushDelivery), including the created_at / updated_at / deleted_at
--  that every Medusa model adds. If you change the model, update this.
--
--  status:
--    sent    — push service accepted it (201)
--    failed  — transient error, retry on the next campaign
--    expired — endpoint permanently gone (404/410), subscription pruned
--    invalid — permanently rejected (400/403/413), usually a VAPID-key
--              mismatch; subscription deactivated, row kept for audit
-- ===================================================================

CREATE TABLE IF NOT EXISTS "push_delivery" (
  "id"              text         NOT NULL,
  "campaign_id"     text         NOT NULL,
  "subscription_id" text         NULL,
  "endpoint"        text         NOT NULL,
  "customer_id"     text         NULL,
  "status"          text         NOT NULL DEFAULT 'sent',
  "status_code"     integer      NULL,
  "error"           text         NULL,
  "attempts"        integer      NOT NULL DEFAULT 1,
  "shown_at"        timestamptz  NULL,
  "clicked_at"      timestamptz  NULL,
  "created_at"      timestamptz  NOT NULL DEFAULT now(),
  "updated_at"      timestamptz  NOT NULL DEFAULT now(),
  "deleted_at"      timestamptz  NULL,
  CONSTRAINT "push_delivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_delivery_status_check"
    CHECK ("status" IN ('sent', 'failed', 'expired', 'invalid'))
);

CREATE INDEX IF NOT EXISTS "IDX_push_delivery_campaign_id"
  ON "push_delivery" ("campaign_id") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_push_delivery_endpoint"
  ON "push_delivery" ("endpoint") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_push_delivery_status"
  ON "push_delivery" ("status") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_push_delivery_deleted_at"
  ON "push_delivery" ("deleted_at") WHERE "deleted_at" IS NULL;
