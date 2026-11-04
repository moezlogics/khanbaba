import { HttpTypes } from "@medusajs/types"

/**
 * Build the canonical URL path for a category by walking its
 * `parent_category` chain to the root. Returns a slash-separated
 * string of category handles, e.g. `"fashion/men/kurta"`.
 *
 * The returned value is *just the handle chain* — use `categoryUrl()`
 * for an href, which adds the `/collection/` base.
 *
 * Requirements:
 *  - `category.handle` is required.
 *  - `category.parent_category` should be populated as deep as the
 *    deepest displayed category. The data layer (`listCategories` /
 *    `getCategoryByHandle`) requests five levels of nesting, which
 *    is more than enough for any realistic shop taxonomy.
 *
 * If a parent in the chain is missing its handle, the chain is
 * truncated at that point (defensive — never produce a broken URL
 * with `undefined` segments).
 */
export function buildCategoryPath(
  category: Pick<HttpTypes.StoreProductCategory, "handle"> & {
    parent_category?: any | null
  }
): string {
  if (!category?.handle) return ""

  const segments: string[] = [category.handle]
  let parent: any = category.parent_category
  while (parent && parent.handle) {
    segments.unshift(parent.handle)
    parent = parent.parent_category
  }
  return segments.join("/")
}

/** URL prefix for category pages — WooCommerce's category base on the old site. */
export const CATEGORY_BASE = "collection"

/**
 * Public URL of a category, in the old WordPress structure:
 *   /collection/<handle>            (top level)
 *   /collection/<parent>/<handle>   (nested, as WooCommerce did)
 */
export function categoryUrl(
  category: Pick<HttpTypes.StoreProductCategory, "handle"> & { parent_category?: any | null }
): string {
  const path = buildCategoryPath(category)
  return path ? `/${CATEGORY_BASE}/${path}` : `/${CATEGORY_BASE}`
}

/**
 * Traverses up the category chain from a leaf category to the root parent,
 * returning the ordered chain of categories.
 */
export function buildCategoryChain(leaf: any): any[] {
  if (!leaf) return []
  const chain: any[] = []
  let cur: any = leaf
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent_category
  }
  return chain
}

