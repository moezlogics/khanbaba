import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type Size = "default" | "lg"

/**
 * Price block: price in the brand colour, the "% OFF" badge, and — on a
 * sale — the struck-through regular price with how much the shopper saves
 * (the line that most moves a discount shopper).
 */
export default function ProductPrice({
  product,
  variant,
  size = "default",
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  /** `lg` = PDP hero size. `default` = card / cross-sell size. */
  size?: Size
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-surface animate-pulse rounded" />
  }

  const isSale = selectedPrice.price_type === "sale"
  const saving =
    isSale && selectedPrice.original_price_number > selectedPrice.calculated_price_number
      ? selectedPrice.original_price_number - selectedPrice.calculated_price_number
      : 0
  const priceClass =
    size === "lg"
      ? "text-[28px] small:text-[32px] font-extrabold leading-none tracking-tight"
      : "text-2xl font-bold"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <span className={clx(priceClass, "text-primary")}>
          {!variant && <span className="text-[0.55em] font-semibold text-ink/60 mr-1">From</span>}
          <span
            data-testid="product-price"
            data-value={selectedPrice.calculated_price_number}
            suppressHydrationWarning
          >
            {selectedPrice.calculated_price}
          </span>
        </span>
        {isSale && selectedPrice.percentage_diff && (
          <span className="inline-flex items-center text-[11px] small:text-[12px] font-bold uppercase tracking-wide bg-danger text-white px-2 py-1 rounded-full leading-none">
            {selectedPrice.percentage_diff}% OFF
          </span>
        )}
      </div>
      {isSale && (
        <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span
            className="line-through text-ink/45"
            data-testid="original-product-price"
            data-value={selectedPrice.original_price_number}
            suppressHydrationWarning
          >
            {selectedPrice.original_price}
          </span>
          {saving > 0 && (
            <span className="font-semibold text-success" suppressHydrationWarning>
              You save{" "}
              {convertToLocale({ amount: saving, currency_code: selectedPrice.currency_code })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
