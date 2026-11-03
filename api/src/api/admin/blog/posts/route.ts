import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"
import BlogModuleService from "../../../../modules/blog/service"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 120) || `post-${Date.now()}`
}

// GET /admin/blog/posts — list with pagination and filters
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const q = req.query as Record<string, any>

  const limit = Math.min(parseInt(q.limit || "20", 10), 100)
  const offset = parseInt(q.offset || "0", 10)
  const filters: Record<string, any> = {}
  if (q.status) filters.status = q.status
  if (q.q) filters.title = { $ilike: `%${q.q}%` }

  const [posts, count] = await blog.listAndCountBlogPosts(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" } as any,
    relations: ["categories"],
  })

  res.json({ posts, count, limit, offset })
}

// POST /admin/blog/posts — create
//
// The post is created in two steps ON PURPOSE.
//
// Creating a blog CATEGORY (plain scalar fields) works, while creating a
// POST did not — and the only structural difference is that the post
// payload carried relations (`categories` many-to-many, `author`
// belongs-to) inline. So the row is inserted with scalar columns first,
// exactly like the category route that works, and the category links are
// attached afterwards. If linking then fails, the post still exists and
// the editor can fix the categories, instead of losing the whole article.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const logger = req.scope.resolve("logger") as any
  const body = (req.body || {}) as Record<string, any>

  if (!body.title) {
    return res.status(400).json({ error: "title is required" })
  }

  const handle = body.handle ? slugify(body.handle) : slugify(body.title)
  const now = new Date()

  const categoryIds: string[] = Array.isArray(body.category_ids)
    ? body.category_ids.filter((c: any) => typeof c === "string" && c)
    : []

  let post: any
  try {
    const [created] = await blog.createBlogPosts([
      {
        title: body.title,
        handle,
        excerpt: body.excerpt || null,
        content: body.content || null,
        featured_image: body.featured_image || null,
        featured_image_alt: body.featured_image_alt || null,
        status: body.status || "draft",
        published_at:
          body.status === "published" ? now : body.published_at || null,
        seo_title: body.seo_title || null,
        seo_description: body.seo_description || null,
        seo_keywords: body.seo_keywords || null,
        // A plain FK column, so it is safe to set on insert. Omitted
        // entirely when no author was picked.
        ...(body.author_id ? { author_id: body.author_id } : {}),
      } as any,
    ])
    post = created
  } catch (e: any) {
    // Without this the admin only ever saw "An unknown error occurred",
    // which hid the real reason and made this impossible to diagnose.
    const message = e?.message || String(e)
    logger?.error?.(`[Blog] create post failed: ${message}`)
    return res.status(500).json({
      error: "Failed to create post",
      message,
      detail: e?.detail || e?.constraint || undefined,
    })
  }

  if (categoryIds.length > 0) {
    try {
      const [withCats] = await blog.updateBlogPosts([
        { id: post.id, categories: categoryIds.map((id) => ({ id })) } as any,
      ])
      post = withCats || post
    } catch (e: any) {
      logger?.warn?.(
        `[Blog] post ${post.id} created but category linking failed: ${
          e?.message || e
        }`
      )
      return res.status(201).json({
        post,
        warning: "Post created, but categories could not be attached.",
        message: e?.message || String(e),
      })
    }
  }

  res.status(201).json({ post })
}
