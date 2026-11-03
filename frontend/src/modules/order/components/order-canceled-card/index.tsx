import React from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Hero card shown in place of the success header when an order is shown
 * as canceled because the item is out of stock.
 *
 * The payment line is derived from the order's real payment status so the
 * page never promises a refund that isn't owed, or says "not charged" when
 * money was actually captured.
 */
export default function OrderCanceledCard({
  displayId,
  paymentStatus,
}: {
  displayId?: number | string
  paymentStatus?: string | null
}) {
  const captured =
    paymentStatus === "captured" || paymentStatus === "partially_captured"
  const authorized =
    paymentStatus === "authorized" || paymentStatus === "partially_authorized"

  const paymentLine = captured
    ? "The amount you paid will be refunded to your original payment method."
    : authorized
    ? "The payment hold on your card will be released — you won't be charged."
    : "You have not been charged for this order."

  return (
    <div className="w-full bg-surface border border-line/35 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center">
      <div className="relative flex items-center justify-center mb-4">
        <span className="absolute inline-flex h-16 w-16 rounded-full bg-danger/10" />
        <div className="w-14 h-14 rounded-full bg-danger flex items-center justify-center shadow-md shadow-danger/20 z-10">
          <i className="ph-bold ph-package text-white text-[26px]" aria-hidden />
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 text-[11px] font-bold uppercase tracking-wide rounded-full bg-danger/10 text-danger border border-danger/20">
        <i className="ph-bold ph-x-circle text-xs" aria-hidden />
        Order Canceled
      </span>

      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink mb-2">
        Sorry, this item is out of stock
      </h1>
      <p className="text-sm text-ink/60 max-w-md leading-relaxed">
        We couldn&apos;t process
        {displayId ? <> order <span className="font-semibold text-ink">#{displayId}</span></> : " your order"}{" "}
        because the item ran out of stock before it could be confirmed.
      </p>

      <ul className="mt-6 w-full max-w-md rounded-2xl bg-bg/60 border border-line/30 p-4 text-left space-y-3">
        <li className="flex items-start gap-3 text-sm text-ink/75">
          <i className="ph-bold ph-wallet text-primary text-lg shrink-0 mt-0.5" aria-hidden />
          <span>{paymentLine}</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-ink/75">
          <i className="ph-bold ph-chat-circle-text text-primary text-lg shrink-0 mt-0.5" aria-hidden />
          <span>Have a question about this order? Our team is happy to help.</span>
        </li>
      </ul>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <LocalizedClientLink
          href="/store"
          className="flex-1 h-11 bg-primary text-primary-fg rounded-full text-sm font-semibold hover:brightness-105 active:scale-[0.98] transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
        >
          <i className="ph-bold ph-storefront" aria-hidden />
          Continue browsing
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/contact"
          className="flex-1 h-11 bg-surface text-ink border border-line/60 rounded-full text-sm font-semibold hover:bg-surface-alt/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
        >
          <i className="ph-bold ph-headset" aria-hidden />
          Contact support
        </LocalizedClientLink>
      </div>
    </div>
  )
}
