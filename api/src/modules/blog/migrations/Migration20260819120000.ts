import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds the blog_author table (E-E-A-T author profiles) and the nullable
 * author_id FK on blog_post.
 *
 * Hand-written on purpose so it applies with a plain `medusa db:migrate`
 * (no `db:generate` needed). author_id is NULLABLE and the FK is
 * `on delete set null`, so every pre-existing post keeps working and
 * deleting an author never deletes their posts.
 *
 * All statements are guarded (if [not] exists / drop-then-add) so the
 * migration is safe to re-run.
 */
export class Migration20260819120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "blog_author" ("id" text not null, "name" text not null, "handle" text not null, "role" text null, "bio" text null, "avatar_url" text null, "email" text null, "expertise" text null, "twitter_url" text null, "linkedin_url" text null, "facebook_url" text null, "website_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_author_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_author_handle_unique" ON "blog_author" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_author_deleted_at" ON "blog_author" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "blog_post" add column if not exists "author_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_author_id" ON "blog_post" ("author_id") WHERE deleted_at IS NULL;`);
    this.addSql(`alter table if exists "blog_post" drop constraint if exists "blog_post_author_id_foreign";`);
    this.addSql(`alter table if exists "blog_post" add constraint "blog_post_author_id_foreign" foreign key ("author_id") references "blog_author" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "blog_post" drop constraint if exists "blog_post_author_id_foreign";`);
    this.addSql(`drop index if exists "IDX_blog_post_author_id";`);
    this.addSql(`alter table if exists "blog_post" drop column if exists "author_id";`);
    this.addSql(`drop table if exists "blog_author" cascade;`);
  }

}
