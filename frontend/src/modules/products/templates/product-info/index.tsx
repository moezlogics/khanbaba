import React from "react"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductReviewStats } from "@lib/data/reviews"
import { buildCategoryChain, categoryUrl } from "@lib/util/category-path"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
  /**
   * `top`  — breadcrumb row, rendered above the gallery
   * `main` — title and rating (buy-box column)
   */
  mode?: "top" | "main"
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const stars = [1, 2, 3, 4, 5].map((star) => {
    if (rating >= star) return "full"
    if (rating >= star - 0.5) return "half"
    return "empty"
  })

  return (
    <a
      href="#reviews"
      className="inline-flex items-center gap-1.5 text-ink/70 hover:text-primary transition-colors"
    >
      <span className="flex items-center text-warning">
        {stars.map((type, i) => (
          <i
            key={i}
            className={`ph-fill ${
              type === "half" ? "ph-star-half" : "ph-star"
            } text-[13px] ${type === "empty" ? "opacity-25" : ""}`}
            aria-hidden
          />
        ))}
      </span>
      <span className="text-[12.5px]">
        {rating.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </a>
  )
}

const ProductInfo = async ({ product, mode = "main" }: ProductInfoProps) => {
  if (mode === "top") {
    const categoryChain = buildCategoryChain(product.categories?.[0])

    return (
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-ink/55 whitespace-nowrap overflow-x-auto w-full no-scrollbar"
      >
        <LocalizedClientLink href="/" className="hover:text-primary transition-colors">
          Home
        </LocalizedClientLink>
        {categoryChain.map((c) => (
          <React.Fragment key={c.id}>
            <i className="ph ph-caret-right text-[10px]" aria-hidden />
            <LocalizedClientLink
              href={categoryUrl(c)}
              className="hover:text-primary transition-colors"
            >
              {c.name}
            </LocalizedClientLink>
          </React.Fragment>
        ))}
        <i className="ph ph-caret-right text-[10px]" aria-hidden />
        <span className="text-ink truncate max-w-[240px]">{product.title}</span>
      </nav>
    )
  }

  const stats = await getProductReviewStats(product.id).catch(() => null)
  const hasRating = !!(stats && stats.reviewCount > 0)

  return (
    <div className="flex flex-col gap-2">
      <h1
        className="font-heading text-[28px] small:text-[38px] text-ink leading-[1.12]"
        data-testid="product-title"
      >
        {product.title}
      </h1>

      {hasRating && <StarRating rating={stats!.averageRating} count={stats!.reviewCount} />}
    </div>
  )
}

export default ProductInfo
