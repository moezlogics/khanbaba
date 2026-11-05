"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { addToCart } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/context/user-data-context"
import { useCartDrawer } from "@lib/context/cart-drawer-context"
import { trackAddToCart } from "@lib/analytics"
import { getPricesForVariant } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../../thumbnail"
import type { ProductCardProps } from "./types"

type Variant = NonNullable<ProductCardProps["product"]["variants"]>[number]

/** "250g" → 250, "2KG" → 2000; null when the value isn't a weight. */
function grams(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(kg|g)\s*$/i.exec(value)
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2].toLowerCase() === "kg" ? n * 1000 : n
}

/** The option that holds the pack size (the one with several values). */
function sizeOption(product: ProductCardProps["product"]) {
  return (product.options ?? []).find((o) => (o.values ?? []).length > 1) ?? product.options?.[0]
}

/** Pack sizes on offer, smallest first (250g, 500g, 1000g, 2KG). */
function packSizes(product: ProductCardProps["product"]): string[] {
  const values = (sizeOption(product)?.values ?? []).map((v) => v.value).filter(Boolean)
  if (values.length < 2) return []
  const weights = values.map(grams)
  if (weights.some((w) => w === null)) return values
  return values
    .map((v, i) => ({ v, w: weights[i] as number }))
    .sort((a, b) => a.w - b.w)
    .map((x) => x.v)
}

/** The variant that has this pack size. */
function variantForSize(
  product: ProductCardProps["product"],
  optionId: string | undefined,
  size: string
): Variant | undefined {
  return (product.variants ?? []).find((v) =>
    (v.options ?? []).some(
      (o: any) => o.value === size && (!optionId || !o.option_id || o.option_id === optionId)
    )
  )
}

/**
 * Khan Baba card — the WordPress (Woodmart) product tile, Shopify-style:
 * the pack sizes are buttons. Picking one updates the price, the struck
 * regular price and the "-%" pill, and "Add to cart" adds that exact size
 * (then slides the cart drawer in). Products without sizes add directly.
 */
export default function KhanBabaCardClient({
  productPath,
  product,
  isFeatured,
  aspectClass,
  cheapestPrice,
  thumbnailAlt,
  priority,
  sizes,
}: ProductCardProps) {
  const href = productPath || `/product/${product.handle}`
  const countryCode = useParams().countryCode as string
  const { open: openCartDrawer } = useCartDrawer()

  const optionId = sizeOption(product)?.id
  const packs = useMemo(() => packSizes(product), [product])

  // Pre-select the WordPress default size (metadata.default_size), else
  // the smallest pack — same rule as the product page.
  const [size, setSize] = useState<string | null>(() => {
    if (!packs.length) return null
    const preferred = String((product.metadata as any)?.default_size ?? "")
    return packs.includes(preferred) ? preferred : packs[0]
  })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(false)

  const variant: Variant | undefined = size
    ? variantForSize(product, optionId, size)
    : product.variants?.length === 1
    ? product.variants[0]
    : undefined
  const price = (variant && getPricesForVariant(variant)) || cheapestPrice || null
  const onSale =
    !!price &&
    price.price_type === "sale" &&
    Number(price.original_price_number) > Number(price.calculated_price_number)

  const handleAdd = async () => {
    if (!variant?.id || adding) return
    setAdding(true)
    setError(false)
    try {
      await addToCart({ variantId: variant.id, quantity: 1, countryCode })
      notifyCartUpdated()
      trackAddToCart({
        id: product.id,
        title: product.title || "",
        variant: variant.title || "",
        price: (variant as any).calculated_price?.calculated_amount || 0,
        quantity: 1,
        currency: (variant as any).calculated_price?.currency_code || "pkr",
      })
      openCartDrawer()
    } catch {
      setError(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <article
      className={`group relative flex flex-col h-full rounded-[var(--radius-card)] border border-line bg-bg overflow-hidden transition-shadow hover:shadow-[0_10px_28px_-14px_rgba(96,63,38,0.35)]${
        priority ? "" : " cv-card"
      }`}
    >
      <div className="relative">
        <LocalizedClientLink href={href} aria-label={product.title} data-testid="product-link">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            aspectClass={aspectClass}
            alt={thumbnailAlt}
            priority={priority}
            sizes={sizes}
            data-testid="product-wrapper"
          />
        </LocalizedClientLink>

        {onSale && price?.percentage_diff && (
          <span className="absolute top-2 left-2 z-[1] pointer-events-none rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[11px] small:text-[12px] font-bold leading-none px-2 py-1.5">
            -{price.percentage_diff}%
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5 small:p-3.5 flex-1">
        <LocalizedClientLink
          href={href}
          data-testid="product-title"
          className="text-[14px] small:text-[17px] font-bold text-ink hover:text-primary transition-colors line-clamp-2 leading-snug"
        >
          {product.title}
        </LocalizedClientLink>

        {price && (
          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5" aria-live="polite">
            <span className="text-[15px] small:text-[18px] font-bold text-primary" data-testid="price">
              {price.calculated_price}
            </span>
            {onSale && (
              <span className="text-[12px] small:text-[14px] line-through text-ink/60" data-testid="original-price">
                {price.original_price}
              </span>
            )}
          </div>
        )}

        {packs.length > 0 && (
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Choose a size">
            {packs.map((s) => {
              const selected = s === size
              const available = !!variantForSize(product, optionId, s)
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!available}
                  onClick={() => setSize(s)}
                  className={`min-w-[2.75rem] text-[12px] font-bold leading-none px-2 py-1.5 rounded-[var(--radius-btn)] border transition-colors disabled:opacity-40 disabled:line-through ${
                    selected
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-ink/25 text-ink hover:border-primary hover:text-primary"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-auto pt-1.5">
          {variant?.id ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              aria-label={`Add ${size ? `${size} of ` : ""}${product.title} to cart`}
              className="w-full flex items-center justify-center gap-1.5 label-caps min-h-[42px] small:min-h-[46px] py-2.5 px-2 whitespace-nowrap leading-none rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[12px] small:text-[14px] transition-[filter] hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
            >
              <i
                className={`ph-bold ${adding ? "ph-spinner animate-spin" : "ph-shopping-bag"} text-[14px]`}
                aria-hidden
              />
              {adding ? "Adding…" : "Add to cart"}
            </button>
          ) : (
            <LocalizedClientLink
              href={href}
              className="w-full flex items-center justify-center gap-1.5 label-caps min-h-[42px] small:min-h-[46px] py-2.5 px-2 whitespace-nowrap leading-none rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[12px] small:text-[14px] transition-[filter] hover:brightness-110"
            >
              <i className="ph-bold ph-eye text-[14px]" aria-hidden />
              View product
            </LocalizedClientLink>
          )}
          {error && (
            <p className="mt-1 text-[11px] text-danger text-center" role="alert">
              Couldn&apos;t add — please try again.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
