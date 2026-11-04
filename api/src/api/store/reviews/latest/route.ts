import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADVANCED_REVIEWS_MODULE } from "../../../../modules/advanced_reviews"

/**
 * GET /store/reviews/latest?limit=8
 *
 * Newest approved 4–5 star reviews across the whole store, for the
 * homepage "What our customers say" strip. Only what that strip shows
 * leaves the server: the reviewer's first name and last initial (never an
 * email), the text, the rating, the date and the reviewed product.
 *
 * Also returns the average and count over every approved review, so the
 * strip's summary reflects all of them rather than just the ones shown.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "8"), 10) || 8, 1), 12)
  const reviewService: any = req.scope.resolve(ADVANCED_REVIEWS_MODULE)
  const query = req.scope.resolve("query") as any

  try {
    const all: any[] = await reviewService.listAdvancedReviews(
      { status: "approved" },
      { select: ["id", "rating"], take: 5000 }
    )
    const count = all.length
    const average = count ? all.reduce((n, r) => n + Number(r.rating || 0), 0) / count : 0

    const reviews: any[] = await reviewService.listAdvancedReviews(
      { status: "approved", rating: { $gte: 4 } },
      { take: limit, order: { created_at: "DESC" } }
    )

    const productIds = Array.from(new Set(reviews.map((r) => r.product_id).filter(Boolean)))
    const customerIds = Array.from(new Set(reviews.map((r) => r.customer_id).filter(Boolean)))

    const [products, customers] = await Promise.all([
      productIds.length
        ? query
            .graph({
              entity: "product",
              fields: ["id", "title", "handle", "thumbnail", "categories.handle"],
              filters: { id: productIds, status: "published" },
            })
            .then((r: any) => r.data || [])
        : [],
      customerIds.length
        ? query
            .graph({
              entity: "customer",
              fields: ["id", "first_name", "last_name"],
              filters: { id: customerIds },
            })
            .then((r: any) => r.data || [])
        : [],
    ])
    const productById = new Map<string, any>(products.map((p: any) => [p.id, p]))
    const customerById = new Map<string, any>(customers.map((c: any) => [c.id, c]))

    const shortName = (first?: string | null, last?: string | null) => {
      const f = (first || "").trim()
      const l = (last || "").trim()
      if (!f && !l) return "Verified customer"
      return l ? `${f} ${l.charAt(0).toUpperCase()}.` : f
    }

    const out = reviews
      .map((r) => {
        const p = productById.get(r.product_id)
        if (!p) return null
        const c = r.customer_id ? customerById.get(r.customer_id) : null
        const guestParts = String(r.guest_name || "").trim().split(/\s+/)
        return {
          id: r.id,
          rating: Number(r.rating),
          content: String(r.content || ""),
          name: c
            ? shortName(c.first_name, c.last_name)
            : shortName(guestParts[0], guestParts.length > 1 ? guestParts[guestParts.length - 1] : ""),
          is_verified: !!r.is_verified,
          created_at: r.created_at,
          product: {
            title: p.title,
            handle: p.handle,
            thumbnail: p.thumbnail || null,
            category_handle: p.categories?.[0]?.handle || null,
          },
        }
      })
      .filter(Boolean)

    res.setHeader("Cache-Control", "public, max-age=300")
    res.json({ reviews: out, count, average: Math.round(average * 10) / 10 })
  } catch (e: any) {
    res.status(500).json({ reviews: [], count: 0, average: 0, error: e?.message || "Failed to load reviews" })
  }
}
