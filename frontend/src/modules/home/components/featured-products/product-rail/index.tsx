import { listProducts } from "@lib/data/products"
import {
  getSiteSettings,
  resolveProductCardAspectClass,
} from "@lib/data/site-settings"
import { PRODUCT_CARD_FIELDS } from "@lib/util/product-card-fields"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

type RailCategory = { id: string; name: string; handle: string }

/**
 * Anvogue-styled product rail used on the homepage.
 *
 * One of three modes:
 *   • `category` → heading = category name, products filtered to that
 *                  category, "View All" → the category page. (Used by the
 *                  admin Homepage Builder, one rail per configured section.)
 *   • `collection` → heading = collection title, "View All" → collection.
 *   • neither   → `title` (default "Latest Products"), newest products,
 *                  "View All" → /store.
 *
 * `limit` controls how many products the rail shows (admin-set per section).
 */
export default async function ProductRail({
  collection,
  category,
  limit = 10,
  title,
  eagerImages = 0,
  region,
}: {
  collection?: HttpTypes.StoreCollection
  category?: RailCategory
  limit?: number
  /** Heading for the uncategorised rail (e.g. "Weekly Discounts"). */
  title?: string
  /** How many leading cards load their image eagerly (above-the-fold rails only). */
  eagerImages?: number
  region: HttpTypes.StoreRegion
}) {
  const safeLimit = Math.max(1, Math.min(24, Number(limit) || 10))

  const [
    {
      response: { products: pricedProducts },
    },
    settings,
  ] = await Promise.all([
    listProducts({
      regionId: region.id,
      queryParams: {
        ...(category?.id ? { category_id: [category.id] } : {}),
        ...(collection?.id ? { collection_id: collection.id } : {}),
        order: "-created_at",
        limit: safeLimit,
        // Light card fields — homepage rail doesn't need variant images/
        // metadata/tags (big payload cut on the most-visited page).
        fields: PRODUCT_CARD_FIELDS,
      } as any,
    }),
    getSiteSettings(),
  ])

  if (!pricedProducts?.length) return null

  const rankedProducts = pricedProducts as any[]

  const aspectClass = resolveProductCardAspectClass(settings)

  const heading = category?.name || collection?.title || title || "Latest Products"
  const viewAllHref = category
    ? `/${category.handle}`
    : collection
      ? `/collections/${collection.handle}`
      : `/store`

  return (
    <section className="pt-0 pb-2">
      <div className="mb-3 small:mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[22px] small:text-[30px] font-semibold text-ink leading-tight">{heading}</h2>
        <LocalizedClientLink
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
        >
          View all
          <i className="ph-bold ph-arrow-right text-[12px]" aria-hidden />
        </LocalizedClientLink>
      </div>

      {/* Mobile: a swipeable row (keeps the page short, app-like).
          small+: a grid of 4 → 5 columns. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar small:mx-0 small:grid small:grid-cols-4 small:gap-x-5 small:gap-y-7 small:overflow-visible small:px-0 medium:grid-cols-5">
        {rankedProducts.map((product, index) => (
          <li
            key={product.id}
            className="w-[44%] shrink-0 snap-start xsmall:w-[30%] small:w-auto"
          >
            <ProductPreview
              product={product}
              region={region}
              aspectClass={aspectClass}
              priority={index < eagerImages}
              sizes="(max-width: 511px) 44vw, (max-width: 1023px) 30vw, (max-width: 1279px) 24vw, 260px"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
