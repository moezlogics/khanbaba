import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"
import { getProductPath } from "@lib/util/product"

type Props = {
  /** Candidate products for the image collage — the biggest discounts are shown. */
  products: HttpTypes.StoreProduct[]
  whatsappNumber?: string | null
  /** Store-wide review summary; shown only when there are enough reviews to mean something. */
  rating?: { average: number; count: number } | null
}

/**
 * Homepage hero used when no banner has been uploaded in the admin (the
 * banner slider replaces it as soon as one exists).
 *
 * Built from real store data only: three products with the deepest
 * discounts, the actual delivery and payment terms, and the review
 * average when there are at least three reviews behind it. It carries the
 * page's only <h1>; the SEO article further down is demoted to <h2>s.
 */
export default function BrandHero({ products, whatsappNumber, rating }: Props) {
  const picks = products
    .filter((p) => p.thumbnail)
    .map((p) => ({ p, price: getProductPrice({ product: p }).cheapestPrice }))
    .sort((a, b) => Number(b.price?.percentage_diff || 0) - Number(a.price?.percentage_diff || 0))
    .slice(0, 3)

  const wa = whatsappNumber?.replace(/\D/g, "")
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent("Assalam o Alaikum, I want to order dry fruits.")}`
    : null
  const showRating = !!rating && rating.count >= 3 && rating.average > 0

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-accent">
      {/* soft decorative glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative grid small:grid-cols-[1.05fr_1fr] items-center gap-6 small:gap-10 px-5 pt-7 pb-6 small:px-12 small:py-14">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bg/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            <i className="ph-fill ph-seal-check text-[13px]" aria-hidden />
            Trusted for 40+ years
          </span>
          <h1 className="mt-3 text-[28px] leading-[1.1] small:text-[48px] font-extrabold tracking-tight text-ink">
            Pure, fresh dry fruits{" "}
            <span className="text-primary">delivered to your door</span>
          </h1>
          <p className="mt-3 max-w-md text-[14px] small:text-[16px] leading-relaxed text-ink/70">
            Hand-picked chilgoza, badam, pista, kaju &amp; dates at wholesale prices — with
            cash on delivery all over Pakistan.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <LocalizedClientLink
              href="/store"
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] bg-primary px-6 text-[15px] font-semibold text-primary-fg shadow-[0_8px_20px_-10px_rgb(var(--color-primary)/0.8)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Shop now
              <i className="ph-bold ph-arrow-right text-[15px]" aria-hidden />
            </LocalizedClientLink>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] border border-primary/30 bg-bg px-5 text-[15px] font-semibold text-ink transition hover:border-primary active:scale-[0.98]"
              >
                <i className="ph-fill ph-whatsapp-logo text-[18px] text-[#25D366]" aria-hidden />
                Order on WhatsApp
              </a>
            )}
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] font-medium text-ink/70">
            <li className="inline-flex items-center gap-1.5">
              <i className="ph-bold ph-truck text-primary" aria-hidden />
              Free delivery over Rs 3,000
            </li>
            <li className="inline-flex items-center gap-1.5">
              <i className="ph-bold ph-hand-coins text-primary" aria-hidden />
              Cash on Delivery
            </li>
            {showRating && (
              <li className="inline-flex items-center gap-1.5">
                <i className="ph-fill ph-star text-warning" aria-hidden />
                {rating!.average.toFixed(1)} from {rating!.count} reviews
              </li>
            )}
          </ul>
        </div>

        {picks.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 small:gap-4">
            {picks.map(({ p, price }, i) => (
              <LocalizedClientLink
                key={p.id}
                href={getProductPath(p)}
                className={`group relative block rounded-[var(--radius-card)] bg-bg p-1.5 shadow-[0_12px_30px_-18px_rgba(96,63,38,0.6)] transition-transform hover:-translate-y-1 ${
                  i === 1 ? "small:-translate-y-6" : ""
                }`}
                aria-label={p.title}
              >
                <div className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-card)-6px)]">
                  <Image
                    src={p.thumbnail!}
                    alt={p.title || "Dry fruits"}
                    fill
                    sizes="(max-width: 1023px) 30vw, 200px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={i === 0}
                  />
                </div>
                {price?.percentage_diff && Number(price.percentage_diff) > 0 && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
                    -{price.percentage_diff}%
                  </span>
                )}
                <span className="mt-1.5 hidden small:block truncate px-1 text-[12.5px] font-semibold text-ink">
                  {p.title}
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
