const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:3122"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * Medusa V2 enforces an `x-publishable-api-key` header on every store
 * route — without it the backend returns 400. The blog endpoints are
 * exposed under `/store/blog/...` so they need the same key any other
 * storefront fetch uses.
 */
const STORE_HEADERS: Record<string, string> = PUBLISHABLE_KEY
  ? { "x-publishable-api-key": PUBLISHABLE_KEY }
  : {}

export type BlogPost = {
  id: string
  title: string
  handle: string
  excerpt: string | null
  content: string | null
  featured_image: string | null
  featured_image_alt: string | null
  status: "draft" | "published"
  published_at: string | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  categories: BlogCategory[]
  author?: BlogAuthor | null
  created_at: string
  updated_at: string
}

export type BlogCategory = {
  id: string
  name: string
  handle: string
  description: string | null
}

export type BlogAuthor = {
  id: string
  name: string
  handle: string
  role: string | null
  bio: string | null
  avatar_url: string | null
  email: string | null
  expertise: string | null
  twitter_url: string | null
  linkedin_url: string | null
  facebook_url: string | null
  website_url: string | null
}

/**
 * Fetch published blog posts from the Medusa store API.
 * Supports pagination, search, and category filtering.
 */
export async function listBlogPosts(params?: {
  limit?: number
  offset?: number
  q?: string
  category?: string
}): Promise<{ posts: BlogPost[]; count: number }> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.offset) searchParams.set("offset", String(params.offset))
  if (params?.q) searchParams.set("q", params.q)
  if (params?.category) searchParams.set("category", params.category)

  const qs = searchParams.toString()
  const res = await fetch(
    `${BACKEND_URL}/store/blog/posts${qs ? `?${qs}` : ""}`,
    {
      headers: STORE_HEADERS,
      next: { revalidate: 60, tags: ["blog"] },
      cache: "force-cache",
    }
  )

  if (!res.ok) {
    console.error("[Blog] Failed to fetch posts:", res.status)
    return { posts: [], count: 0 }
  }

  return res.json()
}

/**
 * Fetch a single published blog post by handle.
 */
export async function getBlogPostByHandle(
  handle: string
): Promise<BlogPost | null> {
  const res = await fetch(
    `${BACKEND_URL}/store/blog/posts/${encodeURIComponent(handle)}`,
    {
      headers: STORE_HEADERS,
      next: { revalidate: 60, tags: ["blog"] },
      cache: "force-cache",
    }
  )

  if (!res.ok) return null

  const data = await res.json()
  return data.post || null
}

/**
 * Fetch a single author profile + their published posts (author archive).
 */
export async function getBlogAuthorByHandle(
  handle: string
): Promise<{ author: BlogAuthor; posts: BlogPost[] } | null> {
  const res = await fetch(
    `${BACKEND_URL}/store/blog/authors/${encodeURIComponent(handle)}`,
    {
      headers: STORE_HEADERS,
      next: { revalidate: 60, tags: ["blog"] },
      cache: "force-cache",
    }
  )

  if (!res.ok) return null

  const data = await res.json()
  if (!data.author) return null
  return { author: data.author, posts: data.posts || [] }
}

/**
 * Fetch all blog categories for filter chips.
 */
export async function listBlogCategories(): Promise<BlogCategory[]> {
  const res = await fetch(`${BACKEND_URL}/store/blog/categories`, {
    headers: STORE_HEADERS,
    next: { revalidate: 300, tags: ["blog"] },
    cache: "force-cache",
  })

  if (!res.ok) return []

  const data = await res.json()
  return data.categories || []
}
