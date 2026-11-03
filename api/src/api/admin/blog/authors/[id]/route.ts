import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../../modules/blog"
import BlogModuleService from "../../../../../modules/blog/service"

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params
  const author = await blog.retrieveBlogAuthor(id)
  res.json({ author })
}

// Medusa admin sometimes POSTs updates; alias to PATCH.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return PATCH(req, res)
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params
  const body = (req.body || {}) as Record<string, any>

  const update: Record<string, any> = { id }
  for (const key of FIELDS) {
    if (key in body) update[key] = body[key]
  }

  const [author] = await blog.updateBlogAuthors([update as any])
  res.json({ author })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const blog: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params
  // Posts keep working — their author_id simply becomes an orphan ref the
  // storefront treats as "no author" (nullable relation).
  await blog.deleteBlogAuthors([id])
  res.json({ id, deleted: true })
}
