/**
 * Store promises strip — icon + headline + subline quartet.
 *
 * The delivery charge is only shown at checkout, never here. Cash on
 * delivery is the only payment method, so this copy states what checkout
 * really does.
 */
const BENEFITS: Array<{
  icon: string
  title: string
  subtitle: string
}> = [
  {
    icon: "truck",
    title: "Nationwide Delivery",
    subtitle: "All over Pakistan in 2–4 days",
  },
  {
    icon: "hand-coins",
    title: "Cash on Delivery",
    subtitle: "Pay when your order arrives",
  },
  {
    icon: "seal-check",
    title: "100% Pure & Fresh",
    subtitle: "Hand-picked, hygienically packed",
  },
  {
    icon: "storefront",
    title: "Wholesale Rates",
    subtitle: "For shops, cafés & events",
  },
]

export default function BenefitsStrip() {
  return (
    <section className="py-5 md:py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="flex items-center gap-2.5 md:gap-3 rounded-[var(--radius-card)] bg-surface px-2.5 py-2.5 md:px-4 md:py-4"
          >
            <div className="w-9 h-9 md:w-11 md:h-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <i className={`ph-bold ph-${b.icon} text-lg md:text-xl text-primary`} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] md:text-sm font-semibold text-ink leading-tight">{b.title}</div>
              <div className="text-[11px] md:text-xs text-ink/60 leading-snug mt-0.5">{b.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
