/**
 * Wholesale call-to-action. Khan Baba is a wholesaler first: shops, cafés
 * and event buyers order in bulk over WhatsApp, so the homepage gives them
 * a direct line. Quiet, on-theme panel; the button is the theme's primary
 * button with a WhatsApp mark. Renders nothing without a WhatsApp number.
 */
export default function WholesaleBand({ whatsappNumber }: { whatsappNumber?: string | null }) {
  const wa = whatsappNumber?.replace(/\D/g, "")
  if (!wa) return null
  const href = `https://wa.me/${wa}?text=${encodeURIComponent(
    "Assalam o Alaikum, I want wholesale rates for a bulk dry fruits order."
  )}`

  return (
    <section className="my-5 small:my-10 rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex flex-col gap-4 px-4 py-6 small:flex-row small:items-center small:justify-between small:gap-10 small:px-12 small:py-12">
        <div className="max-w-xl">
          <p className="text-[12px] small:text-[13px] font-semibold uppercase tracking-[0.18em] text-ink/60">
            Wholesale &amp; bulk orders
          </p>
          <h2 className="mt-2 text-[26px] small:text-[34px] font-semibold leading-tight text-ink">
            Buying for a shop, café or event?
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink/70">
            Get wholesale rates on chilgoza, badam, kaju, pista and dates by the kilo — straight
            from the source.
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[54px] w-full shrink-0 items-center justify-center gap-2.5 rounded-[var(--radius-btn)] bg-primary px-7 text-[17px] font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.98] small:w-auto"
        >
          <i className="ph-fill ph-whatsapp-logo text-[21px]" aria-hidden />
          Get wholesale rates
        </a>
      </div>
    </section>
  )
}
