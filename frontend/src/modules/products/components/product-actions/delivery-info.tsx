"use client"

import { useEffect, useState } from "react"
import { deliveryWindow } from "@lib/util/delivery"

/**
 * Delivery promise under the buy buttons: the expected delivery dates.
 * The delivery charge is not mentioned here — it shows at checkout.
 *
 * Dates are worked out after mount — the page is ISR-cached, so a date
 * rendered on the server could be days old by the time it is served.
 */
export default function DeliveryInfo(_props: {
  /** Kept for callers that still pass them; not used. */
  subtotal?: number | null
  currency?: string
}) {
  const [dates, setDates] = useState<string | null>(null)
  useEffect(() => setDates(deliveryWindow()), [])

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
          <p className="mt-0.5">Delivery all over Pakistan</p>
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
