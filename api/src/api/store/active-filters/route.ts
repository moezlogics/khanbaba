import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /store/active-filters
 *
 * Returns the category ids that actually contain products for a given
 * product-set scope, so the storefront's filter sidebar can hide empty
 * categories.
 *
 * Query params (pick ONE — they're mutually exclusive):
 *   ?category_id=cat_xxx      → categories of the products in that category
 *   ?product_ids=p1,p2,...    → categories of those products
 *   (no params)               → every category that has a product
 *
 * Response:  { category_ids: string[] }
 *
 * Cached for 60s at the HTTP layer so a page refresh doesn't redo the work.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query") as any

  const categoryId = (req.query.category_id || "").toString().trim()
  const productIdsRaw = (req.query.product_ids || "").toString().trim()
  const productIds = productIdsRaw
    ? productIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2000)
    : []

  const categoriesOf = async (filters: Record<string, unknown>, take: number) => {
    try {
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "categories.id"],
        filters,
        pagination: { take } as any,
      })
      const set = new Set<string>()
      for (const p of data || []) {
        for (const c of (p as any).categories || []) {
          if (c?.id) set.add(c.id)
        }
      }
      return Array.from(set)
    } catch {
      return []
    }
  }

  let categoryIds: string[]
  if (productIds.length) {
    categoryIds = await categoriesOf({ id: productIds }, 2000)
  } else if (categoryId) {
    categoryIds = await categoriesOf({ categories: { id: categoryId } }, 2000)
  } else {
    categoryIds = await categoriesOf({}, 10000)
  }

  res.setHeader("Cache-Control", "public, max-age=60")
  return res.json({ category_ids: categoryIds })
}
