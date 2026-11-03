"use client"

/**
 * Client-side grid controller for ISR archive pages.
 *
 * The server renders EVERY product card in scope once (query-independent →
 * ISR-cacheable HTML). This component then applies sort / price / stock
 * filters and pagination CLIENT-SIDE by showing, hiding and
 * re-ordering the server-rendered cards based on the URL query. Filter
 * controls (SortDropdown, ShopFilters…) keep pushing query params exactly
 * as before — nothing re-renders on the server.
 *
 * Results are revealed incrementally (batch of PRODUCT_LIMIT, auto-loaded
 * on scroll with a "Load more" fallback) instead of paginated. Because
 * every card is already in the DOM this costs no network round-trip, and
 * — unlike ?page=N — it never navigates, so the URL stays clean and the
 * scroll position is preserved.
 *
 * The URL is read through a tiny <SearchParamsBridge> wrapped in Suspense:
 * during static generation the bridge bails out (fallback null) so the
 * default listing stays in the static HTML for crawlers; on the client it
 * mounts and drives the reactive filtering.
 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"

/** How many cards are revealed per batch. */
const PRODUCT_LIMIT = 12

export type GridItemMeta = {
  id: string
  /** Cheapest calculated variant price — null when priceless. */
  price: number | null
  inStock: boolean
  createdAt: string | null
}

function SearchParamsBridge({
  onParams,
}: {
  onParams: (qs: string) => void
}) {
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  useEffect(() => {
    onParams(qs)
  }, [qs, onParams])
  return null
}

function applyQuery(items: GridItemMeta[], qs: string) {
  const params = new URLSearchParams(qs)

  const sortBy = params.get("sortBy") || "created_at"
  // `page` is no longer produced by the UI (the grid loads incrementally),
  // but old indexed/bookmarked ?page=N links must still land on content —
  // we translate them into "reveal that many batches" below.
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1)
  const minP = params.get("minPrice") ? Number(params.get("minPrice")) : null
  const maxP = params.get("maxPrice") ? Number(params.get("maxPrice")) : null
  const inStockOnly = params.get("inStock") === "true"

  let indices = items.map((_, i) => i)

  indices = indices.filter((i) => {
    const it = items[i]
    if (inStockOnly && !it.inStock) return false
    if (minP !== null || maxP !== null) {
      if (it.price === null) return false
      if (minP !== null && it.price < minP) return false
      if (maxP !== null && it.price > maxP) return false
    }
    return true
  })

  if (sortBy === "price_asc" || sortBy === "price_desc") {
    indices.sort((a, b) => {
      const pa = items[a].price ?? Number.POSITIVE_INFINITY
      const pb = items[b].price ?? Number.POSITIVE_INFINITY
      return sortBy === "price_asc" ? pa - pb : pb - pa
    })
  } else {
    // "Latest" = most recently added to the catalogue.
    const key = (i: number) =>
      items[i].createdAt ? Date.parse(items[i].createdAt!) : 0
    indices.sort((a, b) => key(b) - key(a))
  }

  return { indices, page }
}

export default function ProductGridClient({
  items,
  cards,
  totalCount,
}: {
  items: GridItemMeta[]
  /** Server-rendered cards, same order as `items`. */
  cards: React.ReactNode[]
  /** Backend total for the unfiltered scope (may exceed items.length). */
  totalCount: number
}) {
  // null → not hydrated yet → render the server default (first batch, latest).
  const [qs, setQs] = useState<string | null>(null)
  // How many matching cards are currently revealed. Grows on demand — the
  // grid never navigates, so the URL stays clean and scroll position is
  // never lost the way it was when pagination pushed ?page=N.
  const [visibleCount, setVisibleCount] = useState(PRODUCT_LIMIT)

  const { indices, deepLinkBatches } = useMemo(() => {
    const { indices, page } = applyQuery(items, qs ?? "")
    return { indices, deepLinkBatches: page }
  }, [items, qs])

  // Changing any filter/sort restarts the reveal at one batch, so a
  // narrowed result set doesn't inherit a huge scroll from the previous
  // one. An inbound ?page=N (old pagination link) opens N batches so those
  // URLs still show the products they used to.
  useEffect(() => {
    setVisibleCount(PRODUCT_LIMIT * Math.max(1, deepLinkBatches))
  }, [qs, deepLinkBatches])

  const view = useMemo(() => {
    const capped = Math.min(visibleCount, indices.length)
    return {
      indices,
      visible: indices.slice(0, capped),
      hasMore: capped < indices.length,
      remaining: indices.length - capped,
    }
  }, [indices, visibleCount])

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + PRODUCT_LIMIT)
  }, [])

  // Infinite loading: reveal the next batch as the sentinel nears the
  // viewport. `rootMargin` starts the work before it is on screen so the
  // grid feels continuous rather than stuttering at the seam. Everything
  // is already in the DOM, so this is pure reveal — no network, no spinner.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !view.hasMore) return
    if (typeof IntersectionObserver === "undefined") return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: "600px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [view.hasMore, loadMore])

  const isFiltered = !!qs && qs.length > 0
  const shownTotal = isFiltered ? view.indices.length : Math.max(totalCount, view.indices.length)

  if (items.length === 0 || view.visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-large border border-dashed border-line bg-surface/40">
        <Suspense fallback={null}>
          <SearchParamsBridge onParams={setQs} />
        </Suspense>
        <i className="ph ph-package text-5xl text-ink/30 mb-4" aria-hidden />
        <p className="text-base font-semibold text-ink mb-1">No products found</p>
        <p className="text-sm text-ink/60">
          Try adjusting your filters or check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsBridge onParams={setQs} />
      </Suspense>
      <p className="text-xs text-ink/55 mb-4" aria-live="polite">
        Showing <span className="text-ink font-medium">{view.visible.length}</span>{" "}
        of {shownTotal} {shownTotal === 1 ? "product" : "products"}
      </p>
      <ul
        className="grid grid-cols-2 xsmall:grid-cols-3 small:grid-cols-4 medium:grid-cols-5 gap-x-3 small:gap-x-5 gap-y-4 small:gap-y-7"
        data-testid="products-list"
      >
        {view.visible.map((i) => (
          <li key={items[i].id}>{cards[i]}</li>
        ))}
      </ul>
      {view.hasMore && (
        <div
          ref={sentinelRef}
          className="flex flex-col items-center gap-2 pt-8 pb-2"
          data-testid="product-load-more"
        >
          {/* The observer above normally reveals the next batch before this
              is reached; the button is the accessible, always-works path
              (keyboard, reduced-motion, observer-less browsers). */}
          <button
            type="button"
            onClick={loadMore}
            className="px-6 py-2.5 rounded-full border border-line bg-surface text-sm font-medium text-ink hover:border-ink/40 hover:bg-surface/70 transition-colors"
          >
            Load more
          </button>
          <span className="text-xs text-ink/45">
            {view.remaining} more {view.remaining === 1 ? "product" : "products"}
          </span>
        </div>
      )}
    </>
  )
}
