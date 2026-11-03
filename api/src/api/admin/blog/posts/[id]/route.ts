import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../../modules/blog"
import BlogModuleService from "../../../../../modules/blog/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params
  const post = await blog.retrieveBlogPost(id, { relations: ["categories"] })
  res.json({ post })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // alias for PATCH (Medusa admin UI sometimes uses POST with _method)
  return PATCH(req, res)
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const logger = req.scope.resolve("logger") as any
  const { id } = req.params
  const body = (req.body || {}) as Record<string, any>

  const update: Record<string, any> = { id }
  const allowed = [
    "title",
    "handle",
    "excerpt",
    "content",
    "featured_image",
    "featured_image_alt",
    "status",
    "published_at",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "author_id",
  ]
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // If publishing for the first time, stamp published_at
  if (body.status === "published" && !body.published_at) {
    update.published_at = new Date()
  }

  // Scalars first, relations second — same split as the create route, so a
  // category-linking problem can never roll back an otherwise valid edit.
  let post: any
  try {
    const [updated] = await blog.updateBlogPosts([update as any])
    post = updated
  } catch (e: any) {
    const message = e?.message || String(e)
    logger?.error?.(`[Blog] update post ${id} failed: ${message}`)
    return res.status(500).json({
      error: "Failed to update post",
      message,
      detail: e?.detail || e?.constraint || undefined,
    })
  }

  if (Array.isArray(body.category_ids)) {
    try {
      const [withCats] = await blog.updateBlogPosts([
        {
          id,
          categories: body.category_ids
            .filter((c: any) => typeof c === "string" && c)
            .map((cid: string) => ({ id: cid })),
        } as any,
      ])
      post = withCats || post
    } catch (e: any) {
      logger?.warn?.(
        `[Blog] post ${id} saved but category linking failed: ${e?.message || e}`
      )
      return res.json({
        post,
        warning: "Post saved, but categories could not be updated.",
        message: e?.message || String(e),
      })
    }
  }

  res.json({ post })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params
  await blog.deleteBlogPosts([id])
  res.json({ id, deleted: true })
}
