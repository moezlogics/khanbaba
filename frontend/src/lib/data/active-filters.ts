// Server-only data function → hit the backend directly (internal/localhost)
// instead of looping out through the public domain + Cloudflare. Prefer the
// internal URL; fall back to the public one, then localhost (3122 — the
// backend's real port).
const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:3122"

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const STORE_HEADERS: Record<string, string> = PUBLISHABLE_KEY
  ? { "x-publishable-api-key": PUBLISHABLE_KEY }
  : {}

/**
 * Resolves the category_ids that actually contain products for the
 * current archive scope, so the filter sidebar can hide empty categories
 * — see backend route `/store/active-filters`.
 *
 *   `getActiveFilters({ categoryId: "cat_xxx" })`
 *     → categories that share products with that category.
 *   `getActiveFilters({ productIds: ["p1", ...] })`
 *     → categories present across that exact product set.
 *
 * When neither argument is supplied, returns an empty list — callers
 * treat empty as "show everything" (e.g. the /store page).
 *
 * Result is intentionally cached for 60s at the Next.js fetch layer
 * since it's purely a function of the inputs.
 */
export type ActiveFilters = {
  category_ids: string[]
}

export async function getActiveFilters(opts: {
  categoryId?: string
  productIds?: string[]
}): Promise<ActiveFilters> {
  const { categoryId, productIds } = opts
  const params = new URLSearchParams()
  if (categoryId) params.set("category_id", categoryId)
  if (productIds && productIds.length) {
    params.set("product_ids", productIds.slice(0, 2000).join(","))
  }
  if (![...params.keys()].length) {
    return { category_ids: [] }
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/active-filters?${params.toString()}`,
      {
        headers: STORE_HEADERS,
        // Bound to the same global tags the backend subscriber emits, so a
        // product / category edit drops this immediately instead of
        // waiting up to 60s for the time-based fallback.
        next: {
          revalidate: 60,
          tags: ["active-filters", "products", "categories"],
        },
        cache: "force-cache",
      }
    )
    if (!res.ok) return { category_ids: [] }
    const json = await res.json()
    return {
      category_ids: Array.isArray(json.category_ids) ? json.category_ids : [],
    }
  } catch {
    return { category_ids: [] }
  }
}
