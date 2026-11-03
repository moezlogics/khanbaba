import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../../modules/blog"
import BlogModuleService from "../../../../../modules/blog/service"

// Public author profile + their published posts (author archive page).
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { handle } = req.params
  const q = req.query as Record<string, any>

  const [author] = await blog.listBlogAuthors({ handle }, { take: 1 })
  if (!author) {
    return res.status(404).json({ error: "Author not found" })
  }

  const limit = Math.min(parseInt(q.limit || "50", 10), 50)
  const offset = parseInt(q.offset || "0", 10)

  const [posts, count] = await blog.listAndCountBlogPosts(
    { author_id: author.id, status: "published" },
    {
      take: limit,
      skip: offset,
      order: { published_at: "DESC" } as any,
      relations: ["categories"],
    }
  )

  res.setHeader("Cache-Control", "public, max-age=120, s-maxage=180")
  res.json({ author, posts, count, limit, offset })
}
