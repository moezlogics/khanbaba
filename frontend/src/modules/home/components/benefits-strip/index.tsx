/**
 * Store promises strip — icon + headline + subline quartet.
 *
 * The delivery threshold matches the backend shipping option (free from
 * Rs 3,000, see api/src/scripts/import-catalog.ts) and cash on delivery is
 * the only payment method, so this copy states what checkout really does.
 */
const BENEFITS: Array<{
  icon: string
  title: string
  subtitle: string
}> = [
  {
    icon: "truck",
    title: "Free Delivery",
    subtitle: "On orders over Rs 3,000",
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
    <section className="py-6 md:py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-3 py-3 md:px-4 md:py-4"
          >
            <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
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
