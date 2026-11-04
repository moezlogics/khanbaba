import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Three equal trust tiles below the buy buttons (the itwarbazar PDP layout),
 * always one row, even on mobile.
 *
 * Every line is a promise checkout and the policy pages actually keep:
 *   - delivery is free from Rs 3,000 (the backend shipping option rule)
 *   - cash on delivery is the only payment method
 *   - refunds are for damaged/incorrect items reported within 24 hours
 *     (the WordPress refund policy carried over to /refund-policy)
 */
const TRUST_ITEMS = [
  { label: "Free Delivery over Rs 3,000", icon: "ph-truck" },
  { label: "Cash on Delivery", icon: "ph-hand-coins" },
  { label: "24h Damage Refund", icon: "ph-arrow-u-up-left", href: "/refund_returns" },
] as const

export default function ProductTrustBadges() {
  return (
    <ul className="grid grid-cols-3 gap-2 small:gap-3 w-full">
      {TRUST_ITEMS.map((item) => {
        const inner = (
          <>
            <i className={`ph ${item.icon} text-[26px] small:text-[28px] text-primary`} aria-hidden />
            <span className="text-[11px] small:text-[12px] font-semibold text-ink leading-snug text-center">
              {item.label}
            </span>
          </>
        )
        const className =
          "flex flex-col items-center justify-center gap-1.5 min-h-[84px] small:min-h-[96px] px-1.5 py-2.5 border border-line bg-bg text-center transition-colors rounded-[var(--radius-btn)]"

        return (
          <li key={item.label} className="min-w-0">
            {"href" in item ? (
              <LocalizedClientLink
                href={item.href}
                className={`${className} hover:border-primary hover:bg-primary/5`}
              >
                {inner}
              </LocalizedClientLink>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
