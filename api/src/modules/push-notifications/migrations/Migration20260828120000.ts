import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds `push_delivery` — the per-recipient delivery log that turns push
 * campaigns from "we sent 4000, 2100 failed, no idea why" into an
 * auditable record of who was reached and what the push service said.
 *
 * Hand-written so it applies with a plain `medusa db:migrate` (no
 * `db:generate` needed). Every statement is guarded, so it is safe to
 * re-run and safe to apply by hand via psql.
 */
export class Migration20260828120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "push_delivery" ("id" text not null, "campaign_id" text not null, "subscription_id" text null, "endpoint" text not null, "customer_id" text null, "status" text check ("status" in ('sent', 'failed', 'expired', 'invalid')) not null default 'sent', "status_code" integer null, "error" text null, "attempts" integer not null default 1, "shown_at" timestamptz null, "clicked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "push_delivery_pkey" primary key ("id"));`);

    // Campaign dashboards read by campaign; the SW callbacks look the row
    // up by (endpoint, campaign) — index both paths.
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_push_delivery_campaign_id" ON "push_delivery" ("campaign_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_push_delivery_endpoint" ON "push_delivery" ("endpoint") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_push_delivery_status" ON "push_delivery" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_push_delivery_deleted_at" ON "push_delivery" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "push_delivery" cascade;`);
  }

}
