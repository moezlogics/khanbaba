import { Suspense } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import SortDropdown from "@modules/store/components/sort-dropdown"
import ActiveFilters from "@modules/store/components/active-filters"
import ShopFilters from "@modules/store/components/shop-filters"
import MobileFilterDrawer from "@modules/store/components/mobile-filter-drawer"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { listCategories } from "@lib/data/categories"
import { getActiveFilters } from "@lib/data/active-filters"
import PaginatedProducts from "./paginated-products"

type Props = {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  minPrice?: string
  maxPrice?: string
  inStock?: string
  /** When rendered from a category landing page. */
  categoryId?: string
  /**
   * Category id + every descendant id (parent archive roll-up). When
   * present this drives the product query so a parent category shows
   * sub-category products too. Falls back to `[categoryId]`.
   */
  categoryIds?: string[]
  /** When rendered from a collection landing page. */
  collectionId?: string
  /** Restrict the grid to these product ids. */
  productsIds?: string[]
  currentCategoryHandle?: string
  currentCategoryName?: string
  /** Page header — overridden for categories / collections. */
  title?: string
  /** Breadcrumb trail override. */
  breadcrumbs?: Array<{ label: string; href?: string }>
  /** Custom children to render below title (e.g. category carousels) */
  children?: React.ReactNode
  searchParams?: Record<string, any>
}

/**
 * Shop / archive template — Shopify-premium layout:
 *   [Breadcrumb]
 *   [Title]                                    [Sort ▾]
 *   ────────────────────────────────────────────────────
 *   [Chips]  [Count]
 *   [Product grid — full width, like the Khan Baba WordPress archive]
 *
 * Filters (categories, price, stock) live in the "Filters" drawer on every
 * screen size.
 */
const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  minPrice,
  maxPrice,
  inStock,
  categoryId,
  categoryIds,
  collectionId,
  productsIds,
  currentCategoryHandle,
  currentCategoryName,
  title,
  breadcrumbs,
  children,
  searchParams,
}: Props) => {
  // NOTE: sortBy/page/minPrice/maxPrice/inStock/searchParams props are
  // intentionally ignored — the server renders the query-independent
  // default listing (ISR/CDN cacheable) and ProductGridClient applies the
  // URL query client-side. The filter controls below are wrapped in
  // Suspense because they call useSearchParams (static render bails them
  // out to the client without breaking the rest of the page).

  // Category product query rolls up descendants when available.
  const effectiveCategoryIds =
    categoryIds && categoryIds.length
      ? categoryIds
      : categoryId
      ? [categoryId]
      : undefined

  const [categories, active] = await Promise.all([
    listCategories().catch(() => []),
    // Scoped pages (a category) narrow the sidebar to categories that
    // actually hold products; /store gets every category back.
    getActiveFilters({
      categoryId,
      productIds: productsIds,
    }).catch(() => ({ category_ids: [] as string[] })),
  ])

  const activeCategoryIds = active.category_ids.length
    ? expandCategoryAncestors(active.category_ids, categories as any[])
    : undefined

  const crumbs =
    breadcrumbs ||
    [
      { label: "Home", href: "/" },
      { label: title || "Shop" },
    ]

  return (
    <div className="container-anvogue pt-2 pb-6" data-testid="category-container">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-3 flex-wrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <LocalizedClientLink
                  href={c.href}
                  className="text-[12px] text-ink/55 hover:text-primary transition-colors"
                >
                  {c.label}
                </LocalizedClientLink>
              ) : (
                <span className="text-[12px] text-ink font-medium">{c.label}</span>
              )}
              {!last && <i className="ph ph-caret-right text-[10px] text-ink/40" aria-hidden />}
            </span>
          )
        })}
      </nav>

      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-line mb-4">
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight text-ink"
          data-testid="store-page-title"
        >
          {title || "All Products"}
        </h1>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <MobileFilterDrawer
              categories={categories}
              currentCategory={currentCategoryHandle}
              activeCategoryIds={activeCategoryIds}
              resultCount={0 /* resolved client-side by ShopFilters summary bar */}
            />
            <SortDropdown />
          </Suspense>
        </div>
      </div>

      {children && <div className="mb-6">{children}</div>}

      {/* Active filter chips */}
      <div className="mb-3 min-h-[2rem]">
        <Suspense fallback={null}>
          <ActiveFilters currentCategoryName={currentCategoryName} />
        </Suspense>
      </div>

      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          countryCode={countryCode}
          categoryId={categoryId}
          categoryIds={effectiveCategoryIds}
          collectionId={collectionId}
          productsIds={productsIds}
        />
      </Suspense>
    </div>
  )
}

export default StoreTemplate

/**
 * Add every parent category of every active category to the visible set,
 * so the category tree in the filters never shows a child without its
 * parent above it.
 */
function expandCategoryAncestors(
  activeIds: string[],
  categories: Array<{ id: string; parent_category_id?: string | null }>
): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out = new Set(activeIds)
  for (const id of activeIds) {
    let cur = byId.get(id)
    let guard = 0
    while (cur?.parent_category_id && guard++ < 16) {
      if (out.has(cur.parent_category_id)) break
      out.add(cur.parent_category_id)
      cur = byId.get(cur.parent_category_id)
    }
  }
  return Array.from(out)
}
