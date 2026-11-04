"use client"

import { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"

/** "250g" → 250, "2KG" → 2000; null when the value isn't a weight. */
export function grams(value: string): number | null {
  const m = /^\s*([\d.]+)\s*(kg|g)\s*$/i.exec(value)
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2].toLowerCase() === "kg" ? n * 1000 : n
}

/** True when every value of the option is a pack weight (250g, 1KG…). */
export function isWeightOption(option: HttpTypes.StoreProductOption): boolean {
  const values = (option.values ?? []).map((v) => v.value)
  return values.length > 1 && values.every((v) => grams(v) !== null)
}

type Props = {
  option: HttpTypes.StoreProductOption
  variants: HttpTypes.StoreProductVariant[]
  current: string | undefined
  onSelect: (optionId: string, value: string) => void
  disabled?: boolean
}

/**
 * Pack-size picker: each size is a clear tile with its own price (and the
 * struck-through regular price when on sale). The selected tile is filled
 * with the brand colour so the choice is obvious at a glance.
 */
export default function SizeCards({ option, variants, current, onSelect, disabled }: Props) {
  const rows = (option.values ?? [])
    .map((ov) => {
      const variant = variants.find((v) =>
        (v.options ?? []).some((o: any) => o.option_id === option.id && o.value === ov.value)
      )
      const cp: any = (variant as any)?.calculated_price
      const price: number | null = typeof cp?.calculated_amount === "number" ? cp.calculated_amount : null
      const original: number | null = typeof cp?.original_amount === "number" ? cp.original_amount : null
      const inStock =
        !!variant &&
        ((variant as any).manage_inventory === false ||
          (variant as any).allow_backorder ||
          ((variant as any).inventory_quantity ?? 0) > 0)
      return {
        value: ov.value,
        grams: grams(ov.value) as number,
        price,
        original,
        currency: (cp?.currency_code as string) || "pkr",
        inStock,
      }
    })
    .sort((a, b) => a.grams - b.grams)

  const money = (amount: number, currency: string) =>
    convertToLocale({ amount: Math.round(amount), currency_code: currency, maximumFractionDigits: 0 })

  return (
    <fieldset className="flex flex-col" data-testid="product-options">
      <legend className="mb-2.5 text-[15px] text-ink">
        <span className="font-semibold">{option.title || "Size"}:</span>{" "}
        <span className="text-ink/70">{current || "Choose a pack"}</span>
      </legend>
      <div className="grid grid-cols-2 xsmall:grid-cols-3 gap-2.5">
        {rows.map((r) => {
          const selected = r.value === current
          const onSale = r.price !== null && r.original !== null && r.original > r.price
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onSelect(option.id, r.value)}
              disabled={disabled || !r.inStock}
              aria-pressed={selected}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-btn)] border-2 px-2 py-2 text-center transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
                selected
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-line bg-bg text-ink hover:border-primary"
              }`}
            >
              <span className="text-[16px] font-bold leading-tight">{r.value}</span>
              {r.price !== null && (
                <span
                  className={`text-[14px] font-semibold ${selected ? "text-primary-fg" : "text-primary"}`}
                  suppressHydrationWarning
                >
                  {money(r.price, r.currency)}
                </span>
              )}
              {onSale && (
                <span
                  className={`text-[12px] line-through ${selected ? "text-primary-fg/75" : "text-ink/50"}`}
                  suppressHydrationWarning
                >
                  {money(r.original as number, r.currency)}
                </span>
              )}
              {!r.inStock && <span className="text-[12px] font-semibold">Sold out</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
