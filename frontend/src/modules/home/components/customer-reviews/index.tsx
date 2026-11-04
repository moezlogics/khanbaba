import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { LatestReview } from "@lib/data/reviews"

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-warning" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`ph-fill ph-star ${s <= Math.round(value) ? "" : "opacity-25"}`}
          style={{ fontSize: size }}
          aria-hidden
        />
      ))}
    </span>
  )
}

/**
 * "Loved by customers" strip — real, approved reviews only (see
 * /store/reviews/latest). Swipeable cards on mobile, a row of four on
 * desktop. Renders nothing until there are at least two reviews to show.
 */
export default function CustomerReviews({
  reviews,
  count,
  average,
}: {
  reviews: LatestReview[]
  count: number
  average: number
}) {
  if (reviews.length < 2) return null

  return (
    <section className="py-8 small:py-12" aria-labelledby="customer-reviews-heading">
      <div className="mb-4 small:mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="customer-reviews-heading" className="text-[22px] small:text-[30px] font-semibold text-ink">
            Loved by customers across Pakistan
          </h2>
          {count > 0 && (
            <p className="mt-1 inline-flex items-center gap-2 text-[13px] text-ink/65">
              <Stars value={average} />
              <span>
                <strong className="text-ink">{average.toFixed(1)}</strong> average · {count}{" "}
                {count === 1 ? "review" : "reviews"}
              </span>
            </p>
          )}
        </div>
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar small:mx-0 small:grid small:grid-cols-4 small:gap-5 small:overflow-visible small:px-0">
        {reviews.slice(0, 8).map((r, i) => {
          const href = r.product.category_handle
            ? `/${r.product.category_handle}/${r.product.handle}`
            : `/${r.product.handle}`
          return (
            <li
              key={r.id}
              className={`w-[78%] shrink-0 snap-start xsmall:w-[46%] small:w-auto ${i >= 4 ? "small:hidden" : ""}`}
            >
              <figure className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-bg p-4">
                <Stars value={r.rating} />
                <blockquote className="mt-2.5 flex-1 text-[14px] leading-relaxed text-ink/80 line-clamp-5">
                  “{r.content}”
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-2 text-[13px]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink truncate">{r.name}</span>
                    {r.is_verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-success">
                        <i className="ph-fill ph-check-circle" aria-hidden />
                        Verified buyer
                      </span>
                    )}
                  </span>
                </figcaption>
                <LocalizedClientLink
                  href={href}
                  className="mt-3 flex items-center gap-2 rounded-[var(--radius-btn)] bg-surface p-1.5 pr-3 text-[12px] font-medium text-ink/75 transition-colors hover:text-primary"
                >
                  {r.product.thumbnail && (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[6px] bg-bg">
                      <Image src={r.product.thumbnail} alt="" fill sizes="32px" className="object-cover" />
                    </span>
                  )}
                  <span className="truncate">{r.product.title}</span>
                </LocalizedClientLink>
              </figure>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
