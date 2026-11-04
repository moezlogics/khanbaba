import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

type HeroProduct = { id: string; title: string; handle: string; thumbnail: string | null }

type Props = {
  /** Store-wide review summary; shown only when there are enough reviews to mean something. */
  rating?: { average: number; count: number } | null
  /** A few best products for the photo collage (needs a thumbnail). */
  products?: HeroProduct[]
}

/**
 * Homepage hero, used only while no banner has been uploaded in the
 * admin — the banner slider replaces it as soon as one exists.
 *
 * A solid brand-colour band: big display headline, one strong white
 * "Shop now" button, a secondary outline button, a trust line, and a
 * collage of real product photos on white tiles. All colours come from
 * the theme (primary / primary-fg), so it follows the Appearance page.
 * It carries the page's only <h1>.
 */
export default function BrandHero({ rating, products = [] }: Props) {
  const showRating = !!rating && rating.count >= 3 && rating.average > 0
  const shots = products.filter((p) => !!p.thumbnail).slice(0, 3)

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-primary text-primary-fg">
      <div className="grid items-center gap-8 px-5 py-10 xsmall:px-8 small:grid-cols-[1.05fr_1fr] small:gap-12 small:px-14 small:py-16">
        <div className="text-center small:text-left">
          <p className="label-caps text-[12px] small:text-[13px] tracking-[0.18em] text-primary-fg/90">
            Premium dry fruits · Since 40+ years
          </p>
          <h1 className="mt-4 font-heading text-[40px] leading-[1.05] text-primary-fg xsmall:text-[48px] small:text-[64px]">
            Pakistan&rsquo;s Finest Dry Fruits
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-primary-fg small:mx-0 small:text-[19px]">
            Hand-picked chilgoza, badam, pista, kaju &amp; dates — fresh stock, wholesale
            prices, cash on delivery across Pakistan.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 xsmall:flex-row xsmall:justify-center small:justify-start">
            <LocalizedClientLink
              href="/shop"
              className="label-caps inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-primary-fg px-8 text-[15px] text-primary shadow-sm transition hover:brightness-95 active:scale-[0.98] xsmall:w-auto"
            >
              Shop now
              <i className="ph-bold ph-arrow-right text-[16px]" aria-hidden />
            </LocalizedClientLink>
            <a
              href="#shop-by-category"
              className="label-caps inline-flex h-[54px] w-full items-center justify-center rounded-[var(--radius-btn)] border-2 border-primary-fg px-7 text-[15px] text-primary-fg transition hover:bg-primary-fg hover:text-primary xsmall:w-auto"
            >
              Shop by category
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] font-semibold text-primary-fg small:justify-start">
            <li className="inline-flex items-center gap-2">
              <i className="ph-bold ph-truck text-[18px]" aria-hidden />
              Free delivery over Rs 3,000
            </li>
            <li className="inline-flex items-center gap-2">
              <i className="ph-bold ph-hand-coins text-[18px]" aria-hidden />
              Cash on Delivery
            </li>
            {showRating && (
              <li className="inline-flex items-center gap-2">
                <i className="ph-fill ph-star text-[17px]" aria-hidden />
                {rating!.average.toFixed(1)} from {rating!.count} reviews
              </li>
            )}
          </ul>
        </div>

        {shots.length > 0 && (
          <div
            className={`grid gap-3 small:gap-4 ${
              shots.length >= 3 ? "grid-cols-3 small:grid-cols-2 small:grid-rows-2" : shots.length === 2 ? "grid-cols-2" : "mx-auto w-full max-w-sm grid-cols-1"
            }`}
          >
            {shots.map((p, i) => (
              <LocalizedClientLink
                key={p.id}
                href={`/product/${p.handle}`}
                aria-label={p.title}
                className={`group relative block aspect-square overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] ${
                  shots.length >= 3 && i === 0 ? "small:row-span-2 small:aspect-auto" : ""
                }`}
              >
                <Image
                  src={p.thumbnail!}
                  alt={p.title}
                  fill
                  priority={i === 0}
                  sizes={
                    i === 0
                      ? "(min-width: 1024px) 320px, 31vw"
                      : "(min-width: 1024px) 220px, 31vw"
                  }
                  className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                />
              </LocalizedClientLink>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
