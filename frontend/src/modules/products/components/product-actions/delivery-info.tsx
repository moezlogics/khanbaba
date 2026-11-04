"use client"

import { useEffect, useState } from "react"
import { convertToLocale } from "@lib/util/money"
import { DELIVERY_FEE, FREE_DELIVERY_FROM, deliveryWindow } from "@lib/util/delivery"

/**
 * Delivery promise under the buy buttons: the expected delivery dates and
 * how far this order is from free delivery, with a progress bar.
 *
 * Dates are worked out after mount — the page is ISR-cached, so a date
 * rendered on the server could be days old by the time it is served.
 */
export default function DeliveryInfo({
  subtotal,
  currency,
}: {
  /** Selected pack price × quantity. */
  subtotal: number | null
  currency: string
}) {
  const [dates, setDates] = useState<string | null>(null)
  useEffect(() => setDates(deliveryWindow()), [])

  const money = (n: number) =>
    convertToLocale({ amount: n, currency_code: currency, maximumFractionDigits: 0 })
  const remaining = subtotal === null ? null : Math.max(0, FREE_DELIVERY_FROM - subtotal)
  const progress = subtotal === null ? 0 : Math.min(100, (subtotal / FREE_DELIVERY_FROM) * 100)

  return (
    <div className="rounded-[var(--radius-btn)] border border-line bg-surface/60 p-3 text-[13px] text-ink/80">
      <div className="flex items-start gap-2.5">
        <i className="ph-bold ph-truck mt-0.5 text-[18px] text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p>
            {dates ? (
              <>
                Delivered <strong className="text-ink">{dates}</strong>
              </>
            ) : (
              <>Delivered in 2–4 working days</>
            )}
          </p>
          {remaining !== null &&
            (remaining === 0 ? (
              <p className="mt-0.5 font-semibold text-success">This order gets FREE delivery</p>
            ) : (
              <p className="mt-0.5" suppressHydrationWarning>
                Add <strong className="text-ink">{money(remaining)}</strong> more for{" "}
                <strong className="text-success">FREE delivery</strong>
                <span className="text-ink/50"> (otherwise {money(DELIVERY_FEE)})</span>
              </p>
            ))}
          {remaining !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  remaining === 0 ? "bg-success" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 border-t border-line pt-2.5">
        <i className="ph-bold ph-hand-coins text-[18px] text-primary" aria-hidden />
        <p>
          <strong className="text-ink">Cash on Delivery</strong> — pay when your order arrives
        </p>
      </div>
    </div>
  )
}
