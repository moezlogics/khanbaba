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
 * Pack-size picker that sells: every size shows its own price, the
 * struck-through regular price when on sale, and the price per kg, so the
 * shopper can see that the bigger pack is the better deal. The size with
 * the lowest per-kg price is tagged "Best value" (only when it is actually
 * cheaper per kg than the smallest pack).
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
      const g = grams(ov.value) as number
      const inStock =
        !!variant &&
        ((variant as any).manage_inventory === false ||
          (variant as any).allow_backorder ||
          ((variant as any).inventory_quantity ?? 0) > 0)
      return {
        value: ov.value,
        grams: g,
        price,
        original,
        currency: (cp?.currency_code as string) || "pkr",
        perKg: price !== null ? (price / g) * 1000 : null,
        inStock,
      }
    })
    .sort((a, b) => a.grams - b.grams)

  const priced = rows.filter((r) => r.perKg !== null)
  const cheapestPerKg = priced.length ? Math.min(...priced.map((r) => r.perKg as number)) : null
  const smallestPerKg = priced[0]?.perKg ?? null
  const bestValue =
    priced.length >= 2 && cheapestPerKg !== null && smallestPerKg !== null && cheapestPerKg < smallestPerKg * 0.99
      ? priced.find((r) => r.perKg === cheapestPerKg)?.value
      : undefined

  const money = (amount: number, currency: string) =>
    convertToLocale({ amount: Math.round(amount), currency_code: currency, maximumFractionDigits: 0 })

  return (
    <fieldset className="flex flex-col gap-2" data-testid="product-options">
      <legend className="mb-2 text-[13px] text-ink/70">
        <span className="font-semibold text-ink">{option.title || "Size"}:</span>{" "}
        {current || "Choose a pack"}
      </legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
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
              className={`relative flex flex-col items-start rounded-[var(--radius-btn)] border px-3 pt-2.5 pb-2 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-line bg-bg hover:border-primary/50"
              }`}
            >
              {r.value === bestValue && (
                <span className="absolute -top-2 right-2 rounded-full bg-success px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wide text-white">
                  Best value
                </span>
              )}
              <span className="text-[15px] font-bold leading-tight text-ink">{r.value}</span>
              {r.price !== null && (
                <span className="mt-0.5 text-[13px] font-semibold text-primary" suppressHydrationWarning>
                  {money(r.price, r.currency)}
                </span>
              )}
              {onSale && (
                <span className="text-[11px] text-ink/40 line-through" suppressHydrationWarning>
                  {money(r.original as number, r.currency)}
                </span>
              )}
              {r.perKg !== null && (
                <span className="mt-1 text-[10.5px] text-ink/55" suppressHydrationWarning>
                  {money(r.perKg, r.currency)}/kg
                </span>
              )}
              {!r.inStock && <span className="mt-1 text-[10.5px] font-semibold text-danger">Sold out</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
