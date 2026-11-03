import { MetadataRoute } from "next"
import { listBlogPosts, listBlogCategories } from "@lib/data/blog"
import { getBaseURL } from "@lib/util/env"
import { buildCategoryPath } from "@lib/util/category-path"
import { getProductPath } from "@lib/util/product"

export const revalidate = 360

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:3122"

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const STORE_HEADERS: Record<string, string> = PUBLISHABLE_KEY
  ? { "x-publishable-api-key": PUBLISHABLE_KEY }
  : {}

function buildQuery(params: Record<string, any>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    sp.append(k, String(v))
  }
  return sp.toString()
}

async function listRegions(): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: STORE_HEADERS,
      next: { tags: ["regions"], revalidate: 60 },
    })
    if (!res.ok) return []
    const { regions } = await res.json()
    return regions || []
  } catch {
    return []
  }
}

async function listProducts({
  pageParam = 1,
  queryParams,
  countryCode,
}: {
  pageParam?: number
  queryParams?: any
  countryCode?: string
}) {
  const limit = queryParams?.limit || 12
  const offset = pageParam === 1 ? 0 : (pageParam - 1) * limit

  let regionId: string | undefined

  if (countryCode) {
    try {
      const regions = await listRegions()
      const region = regions?.find((r) =>
        r.countries?.some((c: any) => c.iso_2 === countryCode)
      )
      regionId = region?.id
    } catch {}
  }

  const query: Record<string, any> = {
    limit,
    offset,
    fields:
      queryParams?.fields ||
      "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+variants.metadata,+metadata,+tags,",
    ...queryParams,
  }
  if (regionId) {
    query.region_id = regionId
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/products?${buildQuery(query)}`,
      {
        headers: STORE_HEADERS,
        next: { tags: ["products"], revalidate: 60 },
      }
    )
    if (!res.ok) {
      return { response: { products: [], count: 0 }, nextPage: null }
    }
    const { products, count } = await res.json()
    const nextPage = count > offset + limit ? pageParam + 1 : null
    return { response: { products: products || [], count: count || 0 }, nextPage }
  } catch {
    return { response: { products: [], count: 0 }, nextPage: null }
  }
}

async function listCollections(queryParams: Record<string, string> = {}) {
  const limit = queryParams.limit || "100"
  const offset = queryParams.offset || "0"

  const fields = queryParams.fields
    ? `${queryParams.fields},+metadata`
    : "+metadata"

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/collections?${buildQuery({
        ...queryParams,
        limit,
        offset,
        fields,
      })}`,
      {
        headers: STORE_HEADERS,
        next: { tags: ["collections"], revalidate: 60 },
      }
    )
    if (!res.ok) return { collections: [], count: 0 }
    const { collections } = await res.json()
    return { collections: collections || [], count: (collections || []).length }
  } catch {
    return { collections: [], count: 0 }
  }
}

async function listCategories(query?: Record<string, any>) {
  const CATEGORY_FIELDS =
    "*category_children, *products, *parent_category, *parent_category.parent_category, *parent_category.parent_category.parent_category, *parent_category.parent_category.parent_category.parent_category, *parent_category.parent_category.parent_category.parent_category.parent_category, +metadata"

  const limit = query?.limit || 100

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/product-categories?${buildQuery({
        fields: CATEGORY_FIELDS,
        limit,
        ...query,
      })}`,
      {
        headers: STORE_HEADERS,
        next: { tags: ["categories"], revalidate: 60 },
      }
    )
    if (!res.ok) return []
    const { product_categories } = await res.json()
    return product_categories || []
  } catch {
    return []
  }
}

const STATIC_PATHS = [
  "",
  "/store",
  "/blog",
  "/contact",
  "/about",
  "/terms",
  "/privacy",
  "/refund-policy",
]

type Entry = MetadataRoute.Sitemap[number]

function entry(
  baseUrl: string,
  path: string,
  lastModified?: string | Date,
  changeFrequency?: Entry["changeFrequency"],
  priority?: number
): Entry {
  let cleaned = path.startsWith("/") ? path : `/${path}`
  
  if (cleaned.includes("?")) {
    const [pathname, search] = cleaned.split("?")
    const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`
    cleaned = `${withSlash}?${search}`
  } else {
    if (!cleaned.endsWith("/") && !cleaned.includes(".")) {
      cleaned = `${cleaned}/`
    }
  }

  return {
    url: `${baseUrl.replace(/\/+$/, "")}${cleaned}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
  }
}

async function getCountryCodes(): Promise<string[]> {
  try {
    const regions = await listRegions()
    const codes = Array.from(
      new Set(
        (regions ?? [])
          .flatMap((r: any) => r.countries?.map((c: any) => c.iso_2) ?? [])
          .filter(Boolean) as string[]
      )
    )
    return codes.length ? codes : ["us"]
  } catch (e) {
    console.error("[sitemap] listRegions failed", e)
    return ["us"]
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseURL()
  const countryCodes = await getCountryCodes()
  const entries: Entry[] = []

  // 1. Static paths
  for (const path of STATIC_PATHS) {
    entries.push(
      entry(
        baseUrl,
        path || "/",
        new Date(),
        path === "" ? "daily" : "weekly",
        path === "" ? 1.0 : 0.7
      )
    )
  }

  try {
    const [
      collectionsData,
      categoriesData,
      postsData,
      blogCatsData,
      productsRes
    ] = await Promise.all([
      listCollections({ fields: "handle" }).catch(() => ({ collections: [], count: 0 })),
      listCategories().catch(() => []),
      listBlogPosts({ limit: 500 }).catch(() => ({ posts: [] })),
      listBlogCategories().catch(() => []),
      listProducts({
        countryCode: countryCodes[0],
        pageParam: 1,
        queryParams: { limit: 5000, fields: "handle,updated_at,*categories,metadata" },
      }).catch(() => ({ response: { products: [], count: 0 } }))
    ])

    // 2. Collections
    const collections = collectionsData.collections || []
    for (const c of collections) {
      if (!c.handle) continue
      entries.push(
        entry(baseUrl, `/collections/${c.handle}`, c.updated_at, "weekly", 0.6)
      )
    }

    // 3. Categories
    const product_categories = categoriesData || []
    for (const cat of product_categories) {
      const path = buildCategoryPath(cat as any)
      if (!path) continue
      entries.push(
        entry(baseUrl, `/${path}`, cat.updated_at, "weekly", 0.6)
      )
    }

    // 4. Blog posts
    const posts = postsData.posts || []
    for (const post of posts) {
      entries.push(
        entry(
          baseUrl,
          `/blog/${post.handle}`,
          post.updated_at || post.published_at || undefined,
          "monthly",
          0.5
        )
      )
    }

    // 5. Blog categories
    const categories = blogCatsData || []
    for (const cat of categories) {
      entries.push(
        entry(baseUrl, `/blog?category=${cat.handle}`, undefined, "weekly", 0.4)
      )
    }

    // 7. Products (with hidden products filtered out)
    const HIDDEN_PRODUCT_IDS = new Set([
      "prod_01KVAAJ903PZ4WY757XES1JJ6T",
      "prod_01KVAA24X1ZTKAE5JG47YW9QE0",
      "prod_01KVA9P34AFCZTTBZABWGT0XPJ",
      "prod_01KVA9BZT07941A8G859PZVC3C"
    ])
    const products = productsRes.response?.products || []
    const filteredProducts = products.filter(
      (p: any) => p && p.id && !HIDDEN_PRODUCT_IDS.has(p.id)
    )

    for (const p of filteredProducts) {
      if (!p.handle) continue
      const path = getProductPath(p)
      entries.push(
        entry(
          baseUrl,
          path,
          p.updated_at ?? undefined,
          "weekly",
          0.8
        )
      )
    }

  } catch (e) {
    console.error("[sitemap] parallel fetching failed", e)
  }

  return entries
}
