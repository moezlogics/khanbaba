import { sdk } from "@lib/config"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "https://api.khanbaba.pk"

export type ProductReview = {
  id: string
  product_id: string
  rating: number
  content: string
  customer_id: string | null
  customer?: {
    first_name?: string
    last_name?: string
    email?: string
    /**
     * Lightweight slice of customer.metadata exposed by the reviews
     * route. Today only `avatar_url` and `gender` are read (powers
     * the Avatar component's gender / photo fallbacks); kept open so
     * future personalisation fields don't need a type bump here.
     */
    metadata?: Record<string, any> | null
  } | null
  guest_name: string | null
  guest_email: string | null
  is_verified: boolean
  photos: string[]
  status: "pending" | "approved" | "flagged"
  owner_reply?: string | null
  created_at: string
}

export type ReviewStats = {
  averageRating: number
  reviewCount: number
  ratingDistribution: Record<number, number>
}

export async function getProductReviewStats(
  productId: string
): Promise<ReviewStats | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/reviews?product_id=${encodeURIComponent(productId)}`,
      {
        next: { revalidate: 60, tags: ["reviews"] },
        cache: "force-cache",
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      averageRating: data.averageRating || 0,
      reviewCount: data.count || 0,
      ratingDistribution: {},
    }
  } catch {
    return null
  }
}

// Server-safe — for JSON-LD review arrays in product templates.
// Uses raw fetch (not the SDK) so it works inside async server components
// and respects the Next.js data cache via `next.revalidate`.
export async function getProductReviewsForJsonLd(
  productId: string,
  limit = 10
): Promise<ProductReview[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/reviews?product_id=${encodeURIComponent(productId)}&status=approved&limit=${limit}`,
      {
        next: { revalidate: 60, tags: ["reviews"] },
        cache: "force-cache",
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.reviews || []
  } catch {
    return []
  }
}

export async function fetchProductReviews(
  productId: string
): Promise<ProductReview[]> {
  try {
    const data = await sdk.client.fetch<{ reviews: ProductReview[] }>(
      "/store/reviews",
      {
        query: { product_id: productId, status: "approved" },
        next: { revalidate: 60, tags: ["reviews"] },
        cache: "force-cache",
      }
    )
    return data.reviews || []
  } catch (e) {
    console.error("[Reviews] list failed", e)
    return []
  }
}

export async function fetchProductReviewStats(
  productId: string
): Promise<ReviewStats | null> {
  // Our new GET /store/reviews already returns the overall count and average.
  // We can just rely on that instead of a dedicated endpoint, but to keep the signature intact:
  try {
    const data = await sdk.client.fetch<{ count: number, averageRating: number }>(
      "/store/reviews",
      {
        query: { product_id: productId },
        next: { revalidate: 60, tags: ["reviews"] },
        cache: "force-cache",
      }
    )
    return {
      averageRating: data.averageRating || 0,
      reviewCount: data.count || 0,
      ratingDistribution: {} // simplified for now
    }
  } catch (e) {
    console.error("[Reviews] stats failed", e)
    return null
  }
}

export async function submitProductReview(
  productId: string,
  payload: { rating: number; content: string; guest_name?: string; guest_email?: string; photos?: string[] }
) {
  return sdk.client.fetch("/store/reviews", {
    method: "POST",
    body: { product_id: productId, ...payload },
  })
}

export type LatestReview = {
  id: string
  rating: number
  content: string
  /** First name + last initial — never an email. */
  name: string
  is_verified: boolean
  created_at: string
  product: {
    title: string
    handle: string
    thumbnail: string | null
    category_handle: string | null
  }
}

/**
 * Newest 4–5 star reviews across the store plus the store-wide average,
 * for the homepage testimonials strip. Server-only, ISR-cached.
 */
export async function getLatestReviews(
  limit = 8
): Promise<{ reviews: LatestReview[]; count: number; average: number }> {
  const empty = { reviews: [] as LatestReview[], count: 0, average: 0 }
  try {
    const res = await fetch(`${BACKEND_URL}/store/reviews/latest?limit=${limit}`, {
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
      },
      next: { revalidate: 300, tags: ["reviews"] },
      cache: "force-cache",
    })
    if (!res.ok) return empty
    const data = await res.json()
    return {
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      count: Number(data.count) || 0,
      average: Number(data.average) || 0,
    }
  } catch {
    return empty
  }
}
