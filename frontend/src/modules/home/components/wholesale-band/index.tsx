/**
 * Wholesale call-to-action. Khan Baba is a wholesaler first: shops, cafés
 * and event buyers order in bulk over WhatsApp, so the homepage gives them
 * a direct line. Renders nothing without a WhatsApp number in settings.
 */
export default function WholesaleBand({ whatsappNumber }: { whatsappNumber?: string | null }) {
  const wa = whatsappNumber?.replace(/\D/g, "")
  if (!wa) return null
  const href = `https://wa.me/${wa}?text=${encodeURIComponent(
    "Assalam o Alaikum, I want wholesale rates for a bulk dry fruits order."
  )}`

  return (
    <section className="my-6 small:my-10 overflow-hidden rounded-[var(--radius-card)] bg-primary text-primary-fg">
      <div className="flex flex-col items-start gap-4 px-5 py-7 small:flex-row small:items-center small:justify-between small:px-12 small:py-10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-fg/70">
            Wholesale &amp; bulk orders
          </p>
          <h2 className="mt-1.5 text-[22px] small:text-[30px] font-extrabold leading-tight">
            Buying for a shop, café or wedding?
          </h2>
          <p className="mt-1.5 max-w-xl text-[14px] small:text-[15px] text-primary-fg/80">
            Get wholesale rates on kilos of chilgoza, badam, kaju, pista and dates — straight
            from the source.
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[var(--radius-btn)] bg-[#25D366] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:brightness-105 active:scale-[0.98]"
        >
          <i className="ph-fill ph-whatsapp-logo text-[20px]" aria-hidden />
          Get wholesale rates
        </a>
      </div>
    </section>
  )
}
