import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"
import BlogModuleService from "../../../../modules/blog/service"

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 120) || `author-${Date.now()}`
  )
}

const FIELDS = [
  "name",
  "handle",
  "role",
  "bio",
  "avatar_url",
  "email",
  "expertise",
  "twitter_url",
  "linkedin_url",
  "facebook_url",
  "website_url",
] as const

// GET /admin/blog/authors — list with pagination + search
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const q = req.query as Record<string, any>

  const limit = Math.min(parseInt(q.limit || "100", 10), 200)
  const offset = parseInt(q.offset || "0", 10)
  const filters: Record<string, any> = {}
  if (q.q) filters.name = { $ilike: `%${q.q}%` }

  const [authors, count] = await blog.listAndCountBlogAuthors(filters, {
    take: limit,
    skip: offset,
    order: { name: "ASC" } as any,
  })

  res.json({ authors, count, limit, offset })
}

// POST /admin/blog/authors — create
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const body = (req.body || {}) as Record<string, any>

  if (!body.name) {
    return res.status(400).json({ error: "name is required" })
  }

  const data: Record<string, any> = {
    handle: body.handle ? slugify(body.handle) : slugify(body.name),
  }
  for (const key of FIELDS) {
    if (key === "handle") continue
    data[key] = key in body ? body[key] || null : null
  }

  const [author] = await blog.createBlogAuthors([data as any])
  res.status(201).json({ author })
}
