import { model } from "@medusajs/framework/utils"

/**
 * BlogAuthor — E-E-A-T author profiles for the blog.
 *
 * One author has many posts; a post belongs to at most one author. The
 * relation is nullable so legacy posts created before authors existed keep
 * working (their `author_id` is simply NULL and the frontend falls back to
 * the site/organization byline).
 *
 * `posts` uses a lazy `require("./post")` to avoid a circular import with
 * ./post — the exact pattern ./category already uses for the same reason.
 *
 * The social URLs are surfaced as schema.org `sameAs` on the public author
 * page, which is the concrete signal Google reads for author authority.
 */
export const BlogAuthor: any = model.define("blog_author", {
  id: model.id({ prefix: "bauth" }).primaryKey(),
  name: model.text().searchable(),
  handle: model.text().unique(),
  role: model.text().nullable(), // byline title, e.g. "Senior Mobile Editor"
  bio: model.text().nullable(), // author-box paragraph
  avatar_url: model.text().nullable(),
  email: model.text().nullable(),
  expertise: model.text().nullable(), // short credentials line under the name
  // Authority / social profiles → rendered as schema.org sameAs.
  twitter_url: model.text().nullable(),
  linkedin_url: model.text().nullable(),
  facebook_url: model.text().nullable(),
  website_url: model.text().nullable(),
  posts: model.hasMany(() => require("./post").BlogPost, {
    mappedBy: "author",
  }),
})
