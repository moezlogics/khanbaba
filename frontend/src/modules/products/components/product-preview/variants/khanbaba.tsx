import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../../thumbnail"
import type { ProductCardProps } from "./types"

/** "250g" → 250, "2KG" → 2000; null when the value isn't a weight. */
function grams(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(kg|g)\s*$/i.exec(value)
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2].toLowerCase() === "kg" ? n * 1000 : n
}

/** Pack sizes on offer, smallest first (250g, 500g, 1000g, 2KG). */
function packSizes(product: ProductCardProps["product"]): string[] {
  const option = (product.options ?? []).find((o) => (o.values ?? []).length > 1) ?? product.options?.[0]
  const values = (option?.values ?? []).map((v) => v.value).filter(Boolean)
  if (values.length < 2) return []
  const weights = values.map(grams)
  if (weights.some((w) => w === null)) return values
  return values
    .map((v, i) => ({ v, w: weights[i] as number }))
    .sort((a, b) => a.w - b.w)
    .map((x) => x.v)
}

/**
 * Khan Baba card — the WordPress (Woodmart) product tile: rounded frame,
 * brown "-24%" pill on the photo, bold title, sale price in brand brown
 * with the regular price struck through, the pack sizes as chips, and a
 * "Choose size" button (sizes are picked on the product page).
 */
export default function KhanBabaCard({
  productPath,
  product,
  isFeatured,
  aspectClass,
  cheapestPrice,
  isSale,
  thumbnailAlt,
  priority,
  sizes,
}: ProductCardProps) {
  const href = productPath || `/product/${product.handle}`
  const packs = packSizes(product)
  const shownPacks = packs.slice(0, 4)

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

        {isSale && cheapestPrice?.percentage_diff && (
          <span className="absolute top-2 left-2 z-[1] pointer-events-none rounded-full bg-primary text-primary-fg text-[11px] font-semibold leading-none px-2 py-1">
            -{cheapestPrice.percentage_diff}%
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5 small:p-3.5 flex-1">
        <LocalizedClientLink
          href={href}
          data-testid="product-title"
          className="text-[13px] small:text-[15px] font-bold text-ink hover:text-primary transition-colors line-clamp-2 leading-snug"
        >
          {product.title}
        </LocalizedClientLink>

        {cheapestPrice && (
          <div className="flex items-baseline flex-wrap gap-x-1.5">
            <span className="text-[14px] small:text-[16px] font-bold text-primary" data-testid="price">
              {cheapestPrice.calculated_price}
            </span>
            {isSale && (
              <span className="text-[11.5px] small:text-[12.5px] line-through text-ink/45" data-testid="original-price">
                {cheapestPrice.original_price}
              </span>
            )}
          </div>
        )}

        {shownPacks.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Available sizes">
            {shownPacks.map((s) => (
              <li
                key={s}
                className="text-[10.5px] small:text-[11px] font-medium text-ink/70 border border-line rounded-[var(--radius-btn)] px-1.5 py-0.5 leading-none"
              >
                {s}
              </li>
            ))}
            {packs.length > shownPacks.length && (
              <li className="text-[10.5px] small:text-[11px] font-medium text-ink/50 px-1 py-0.5 leading-none">
                +{packs.length - shownPacks.length}
              </li>
            )}
          </ul>
        )}

        <LocalizedClientLink
          href={href}
          className="mt-auto pt-1.5"
          aria-label={`Choose a size of ${product.title}`}
        >
          <span className="flex items-center justify-center gap-1.5 h-10 px-2 rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[14px] small:text-[15px] font-semibold transition-[filter] group-hover:brightness-110">
            <i className="ph-bold ph-shopping-bag text-[14px]" aria-hidden />
            {packs.length > 1 ? "Choose size" : "View product"}
          </span>
        </LocalizedClientLink>
      </div>
    </article>
  )
}
