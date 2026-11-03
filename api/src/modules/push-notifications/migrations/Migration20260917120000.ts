import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Creates `admin_push_subscription` — the devices of the admin orders app.
 *
 * Until now this table only existed if someone had run the manual
 * `admin-push-table.sql` on the server; no migration created it. On a
 * database where that step was skipped, the admin app could not register
 * a device and every order notification silently found zero recipients.
 *
 * Mirrors the model and the manual SQL exactly, and every statement is
 * guarded, so it is a no-op where the table already exists.
 */
export class Migration20260917120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "admin_push_subscription" ("id" text not null, "endpoint" text not null, "p256dh" text not null, "auth" text not null, "admin_id" text null, "label" text null, "device_browser" text null, "is_active" boolean not null default true, "last_sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "admin_push_subscription_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_admin_push_subscription_endpoint_unique" ON "admin_push_subscription" ("endpoint") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_admin_push_subscription_deleted_at" ON "admin_push_subscription" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "admin_push_subscription" cascade;`);
  }

}
