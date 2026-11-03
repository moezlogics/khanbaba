import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getSiteSettings, resolveProductCardAspectClass } from "@lib/data/site-settings"
import { PRODUCT_CARD_FIELDS } from "@lib/util/product-card-fields"
import ProductPreview from "@modules/products/components/product-preview"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ProductGridClient, { GridItemMeta } from "./product-grid-client"

/**
 * How many products we pull for the active archive/scope (category,
 * collection) on the server. The client-side ProductGridClient then handles
 * sorting, incremental reveal and filter queries without any server-side
 * dynamic bailing. Deliberately above the size of the whole catalogue: the
 * grid loads infinitely and every sort must see the full set.
 */
const SCOPE_LIMIT = 500

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
  fields?: string
}

/**
 * Cheapest calculated price across all variants, as a raw number.
 * Used for client-side price-range filtering.
 */
const cheapestPriceOf = (product: any): number | null => {
  const variants = product?.variants || []
  let min: number | null = null
  for (const v of variants) {
    const raw = v?.calculated_price?.calculated_amount
    if (typeof raw === "number") {
      if (min === null || raw < min) min = raw
    }
  }
  return min
}

const isInStockFn = (product: any): boolean => {
  const variants = product?.variants || []
  // If ANY variant has inventory_quantity > 0, OR allows backorder, OR does
  // not manage inventory — the product is purchasable.
  return variants.some((v: any) => {
    if (v?.allow_backorder) return true
    if (v?.manage_inventory === false) return true
    return typeof v?.inventory_quantity === "number" && v.inventory_quantity > 0
  })
}

export default async function PaginatedProducts({
  collectionId,
  categoryId,
  categoryIds,
  productsIds,
  countryCode,
}: {
  /** @deprecated query params are handled client-side now */
  sortBy?: SortOptions
  /** @deprecated query params are handled client-side now */
  page?: number
  collectionId?: string
  categoryId?: string
  /** Category id + descendants (parent archive roll-up). */
  categoryIds?: string[]
  productsIds?: string[]
  countryCode: string
  /** @deprecated query params are handled client-side now */
  minPrice?: string
  /** @deprecated query params are handled client-side now */
  maxPrice?: string
  /** @deprecated query params are handled client-side now */
  inStock?: boolean
  /** @deprecated query params are handled client-side now */
  searchParams?: Record<string, any>
}) {
  const queryParams: PaginatedProductsParams = {
    limit: SCOPE_LIMIT,
    // Light card fields — drops variants.images/variants.metadata/tags
    // from the grid payload (cards never render them).
    fields: PRODUCT_CARD_FIELDS,
    // Newest first — the grid's default "Latest" order.
    order: "-created_at",
  }

  if (collectionId) queryParams["collection_id"] = [collectionId]
  // Prefer the rolled-up descendant set; fall back to the single id.
  if (categoryIds && categoryIds.length) queryParams["category_id"] = categoryIds
  else if (categoryId) queryParams["category_id"] = [categoryId]
  if (productsIds && productsIds.length) queryParams["id"] = productsIds

  const [region, settings] = await Promise.all([
    getRegion(countryCode),
    getSiteSettings(),
  ])

  if (!region) return null

  const aspectClass = resolveProductCardAspectClass(settings)

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 1,
    queryParams: queryParams as any,
    countryCode,
  })

  const ordered = products as any[]

  const items: GridItemMeta[] = ordered.map((p: any) => ({
    id: p.id,
    price: cheapestPriceOf(p),
    inStock: isInStockFn(p),
    createdAt: p.created_at ?? null,
  }))

  const cards = ordered.map((p: any, index: number) => (
    // Eager-load the first row's images (above the fold) so the listing
    // LCP image isn't lazy.
    <ProductPreview
      key={p.id}
      product={p}
      region={region}
      aspectClass={aspectClass}
      priority={index < 5}
    />
  ))

  return <ProductGridClient items={items} cards={cards} totalCount={count} />
}
