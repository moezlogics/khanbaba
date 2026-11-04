import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = {
  /** Store-wide review summary; shown only when there are enough reviews to mean something. */
  rating?: { average: number; count: number } | null
}

/**
 * Minimal homepage hero, used only while no banner has been uploaded in
 * the admin — the banner slider replaces it as soon as one exists.
 *
 * Shopify-style: a quiet surface, one large heading in the theme's heading
 * font, a short line of copy and a single primary action. Every colour
 * comes from the theme tokens (text on surface, primary-fg on primary), so
 * it stays legible on any preset. It carries the page's only <h1>.
 */
export default function BrandHero({ rating }: Props) {
  const showRating = !!rating && rating.count >= 3 && rating.average > 0

  return (
    <section className="rounded-[var(--radius-card)] bg-surface border border-line">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-12 text-center small:py-20">
        <p className="text-[12px] small:text-[13px] font-semibold uppercase tracking-[0.18em] text-ink/60">
          Premium dry fruits · since 40+ years
        </p>
        <h1 className="mt-4 text-[34px] leading-[1.08] small:text-[56px] font-semibold tracking-tight text-ink">
          Pure, fresh dry fruits, delivered to your door
        </h1>
        <p className="mt-4 max-w-xl text-[16px] small:text-[18px] leading-relaxed text-ink/70">
          Hand-picked chilgoza, badam, pista, kaju and dates at wholesale prices — cash on
          delivery across Pakistan.
        </p>
        <div className="mt-8 flex w-full flex-col items-center gap-3 xsmall:w-auto xsmall:flex-row">
          <LocalizedClientLink
            href="/store"
            className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-primary px-8 text-[17px] font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.98] xsmall:w-auto"
          >
            Shop now
            <i className="ph-bold ph-arrow-right text-[17px]" aria-hidden />
          </LocalizedClientLink>
          <a
            href="#shop-by-category"
            className="inline-flex h-[54px] w-full items-center justify-center rounded-[var(--radius-btn)] border border-ink/20 px-7 text-[17px] font-semibold text-ink transition hover:border-ink/50 xsmall:w-auto"
          >
            Browse categories
          </a>
        </div>
        <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-ink/70">
          <li className="inline-flex items-center gap-1.5">
            <i className="ph ph-truck text-[17px]" aria-hidden />
            Free delivery over Rs 3,000
          </li>
          <li className="inline-flex items-center gap-1.5">
            <i className="ph ph-hand-coins text-[17px]" aria-hidden />
            Cash on Delivery
          </li>
          {showRating && (
            <li className="inline-flex items-center gap-1.5">
              <i className="ph-fill ph-star text-[16px] text-warning" aria-hidden />
              {rating!.average.toFixed(1)} from {rating!.count} reviews
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
