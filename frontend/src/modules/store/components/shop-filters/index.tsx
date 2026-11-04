"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useMemo, useState, useTransition } from "react"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { buildCategoryPath } from "@lib/util/category-path"

type Props = {
  categories: HttpTypes.StoreProductCategory[]
  currentCategory?: string
  activeCategoryIds?: string[]
  minPriceParam?: string
  maxPriceParam?: string
  priceBounds?: { min: number; max: number; currency: string }
  inDrawer?: boolean
}

/**
 * Reusable animated Accordion wrapper for premium UI styling.
 */
const AccordionItem = ({
  title,
  icon,
  activeCount = 0,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: string
  activeCount?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line last:border-b-0 py-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left group focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-surface text-ink/75 group-hover:bg-primary/5 group-hover:text-primary transition-all">
            <i className={`ph-bold ${icon} text-[15px]`} />
          </span>
          <span className="font-semibold text-ink/80 text-[12px] tracking-wider uppercase">{title}</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center bg-primary text-primary-fg text-[10px] font-bold rounded-full w-5 h-5 shadow-sm animate-pulse">
              {activeCount}
            </span>
          )}
        </div>
        <i className={`ph ph-caret-down text-[13px] text-ink/40 group-hover:text-ink transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="mt-4 animate-fade-in-top transition-all duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Custom iOS-style toggle switch.
 */
const ToggleSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) => {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none py-1.5 group">
      <span className="text-sm text-ink/85 group-hover:text-primary transition-colors font-medium">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${checked ? "bg-primary" : "bg-line"}`} />
        <div className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-soft ${checked ? "translate-x-4" : ""}`} />
      </div>
    </label>
  )
}

/**
 * Recursive category node.
 */
const CategoryNode = ({
  category,
  currentCategory,
  depth = 0,
  parentPath = "",
}: {
  category: any
  currentCategory?: string
  depth?: number
  parentPath?: string
}) => {
  const [isExpanded, setIsExpanded] = useState(
    currentCategory === category.handle ||
      category.category_children?.some((c: any) => c.handle === currentCategory)
  )

  const hasChildren = category.category_children && category.category_children.length > 0
  const active = currentCategory === category.handle

  const path = parentPath
    ? `${parentPath}/${category.handle}`
    : buildCategoryPath(category) || category.handle

  return (
    <li className="flex flex-col">
      <div
        className={`flex items-center justify-between rounded-base transition-colors ${
          active ? "bg-ink text-bg font-medium" : "text-ink/80 hover:bg-surface"
        }`}
      >
        <LocalizedClientLink
          href={`/collection/${path}`}
          className="flex-1 px-2 py-1.5"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {category.name}
        </LocalizedClientLink>

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setIsExpanded(!isExpanded)
            }}
            className={`w-8 h-full flex items-center justify-center transition-transform ${
              isExpanded ? "rotate-90" : ""
            } ${active ? "text-bg" : "text-ink/40 hover:text-ink"}`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <i className="ph ph-caret-right text-[12px]" aria-hidden />
          </button>
        )}
        {!hasChildren && !active && (
          <div className="w-8 flex items-center justify-center opacity-40">
            <i className="ph ph-caret-right text-[11px]" aria-hidden />
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="flex flex-col mt-0.5 relative before:content-[''] before:absolute before:left-[14px] before:top-2 before:bottom-2 before:w-[1px] before:bg-line">
          {category.category_children.map((child: any) => (
            <CategoryNode
              key={child.id}
              category={child}
              currentCategory={currentCategory}
              depth={depth + 1}
              parentPath={path}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Creative Overhauled Shop Filters Sidebar component.
 */
const ShopFilters = ({
  categories,
  currentCategory,
  activeCategoryIds,
  minPriceParam = "minPrice",
  maxPriceParam = "maxPrice",
  priceBounds,
  inDrawer = false,
}: Props) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const minPriceValue = searchParams.get(minPriceParam) || ""
  const maxPriceValue = searchParams.get(maxPriceParam) || ""
  const inStock = searchParams.get("inStock") === "true"

  const [minLocal, setMinLocal] = useState(minPriceValue)
  const [maxLocal, setMaxLocal] = useState(maxPriceValue)

  const activeCatSet = useMemo(
    () => (activeCategoryIds ? new Set(activeCategoryIds) : null),
    [activeCategoryIds]
  )

  const topCategories = useMemo(() => {
    const tops = (categories || []).filter((c: any) => !c.parent_category_id)
    if (!activeCatSet) return tops
    return tops.filter((c: any) => activeCatSet.has(c.id))
  }, [categories, activeCatSet])

  const activeCategoriesCount = currentCategory ? 1 : 0
  const activePriceCount = minPriceValue || maxPriceValue ? 1 : 0
  const activeAvailabilityCount = inStock ? 1 : 0

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      params.delete("page") // reset pagination
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  const applyPrice = () => {
    updateParam({
      [minPriceParam]: minLocal || null,
      [maxPriceParam]: maxLocal || null,
    })
  }

  const clearAll = () => {
    setMinLocal("")
    setMaxLocal("")
    const params = new URLSearchParams(searchParams)
    params.delete(minPriceParam)
    params.delete(maxPriceParam)
    params.delete("inStock")
    params.delete("page")

    const keep = params.toString()
    router.replace(keep ? `${pathname}?${keep}` : pathname, { scroll: false })
  }

  return (
    <div
      className={`${inDrawer ? "px-4" : ""} text-sm text-ink pb-6`}
      data-testid="shop-filters"
    >
      {/* Categories Accordion */}
      {topCategories.length > 0 && (
        <AccordionItem title="Categories" icon="ph-squares-four" activeCount={activeCategoriesCount} defaultOpen={true}>
          <ul className="flex flex-col gap-1">
            <li>
              <LocalizedClientLink
                href="/shop"
                className={`block px-2 py-1.5 rounded-base transition-colors ${
                  !currentCategory
                    ? "bg-ink text-bg font-medium"
                    : "text-ink/80 hover:bg-surface"
                }`}
              >
                All products
              </LocalizedClientLink>
            </li>
            {topCategories.map((c: any) => (
              <CategoryNode
                key={c.id}
                category={c}
                currentCategory={currentCategory}
              />
            ))}
          </ul>
        </AccordionItem>
      )}

      {/* Styled Price range Accordion */}
      <AccordionItem title="Price" icon="ph-coins" activeCount={activePriceCount} defaultOpen={false}>
        {priceBounds && (
          <p className="text-xs text-ink/50 mb-3.5 font-medium">
            {priceBounds.currency.toUpperCase()} {priceBounds.min} – {priceBounds.max}
          </p>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={minLocal}
              onChange={(e) => setMinLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice()
              }}
              className="w-full h-9.5 px-3 text-sm rounded-xl border border-line bg-bg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          <span className="text-ink/30 font-medium">—</span>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={maxLocal}
              onChange={(e) => setMaxLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice()
              }}
              className="w-full h-9.5 px-3 text-sm rounded-xl border border-line bg-bg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
        </div>
        <button
          onClick={applyPrice}
          className="mt-3.5 w-full h-9 rounded-xl bg-surface border border-line hover:border-primary/30 text-xs font-semibold text-ink transition-all focus:outline-none"
        >
          Apply Price Filter
        </button>
      </AccordionItem>

      {/* Overhauled Availability Accordion (iOS Switches) */}
      <AccordionItem title="Availability" icon="ph-check-circle" activeCount={activeAvailabilityCount} defaultOpen={true}>
        <div className="flex flex-col gap-2 pt-1">
          <ToggleSwitch
            checked={inStock}
            onChange={(checked) => updateParam({ inStock: checked ? "true" : null })}
            label="In stock only"
          />
        </div>
      </AccordionItem>

      {/* Clear Button */}
      {(minPriceValue || maxPriceValue || inStock) && (
        <button
          onClick={clearAll}
          className="mt-6 w-full h-10.5 rounded-xl border border-line hover:border-primary text-sm font-semibold text-ink/75 hover:bg-surface transition-all focus:outline-none flex items-center justify-center gap-1.5"
        >
          <i className="ph-bold ph-trash-simple text-sm" />
          Clear all filters
        </button>
      )}
    </div>
  )
}

export default ShopFilters
