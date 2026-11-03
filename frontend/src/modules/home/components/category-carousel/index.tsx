"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type CategoryCarouselItem = {
  id: string
  name: string
  handle: string
  image?: string | null
}

type Props = {
  items: CategoryCarouselItem[]
  /** URL prefix for each item link. Defaults to `/` (flat category URLs). */
  linkPrefix?: string
  /** Optional section label for aria. */
  ariaLabel?: string
}

/**
 * Horizontal category rail in the Khan Baba style: each category icon sits
 * in a white circle with a thin border, its name underneath. Without an
 * image, the first letter is shown instead.
 *
 * Scroll: native horizontal on mobile; arrow buttons on desktop.
 *
 * Category URLs are flat (`/badam`) — the root-level catch-all route
 * resolves handles directly.
 */
export default function CategoryCarousel({
  items,
  linkPrefix = "/",
  ariaLabel = "Shop by category",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    el.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [update])

  const scrollBy = (delta: number) => {
    trackRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  if (!items.length) return null

  return (
    <section
      aria-label={ariaLabel}
      className="container-anvogue pt-0 pb-1 relative"
    >
      {/* Arrows (desktop only) */}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-320)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white text-brand-black items-center justify-center box-shadow-sm hover:bg-surface transition"
        >
          <i className="ph-bold ph-arrow-left" aria-hidden />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(320)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white text-brand-black items-center justify-center box-shadow-sm hover:bg-surface transition"
        >
          <i className="ph-bold ph-arrow-right" aria-hidden />
        </button>
      )}

      <div
        ref={trackRef}
        className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-2 py-2 -mx-2"
      >
        {items.map((c) => (
          <LocalizedClientLink
            key={c.id}
            href={`${linkPrefix}${c.handle}`}
            className="group snap-start flex flex-col items-center flex-shrink-0 w-[72px] md:w-[100px]"
          >
            <div className="relative w-[64px] h-[64px] md:w-[92px] md:h-[92px] rounded-full border border-line bg-white flex items-center justify-center overflow-hidden transition-colors group-hover:border-primary">
              {c.image ? (
                <div className="relative w-[74%] h-[74%] transition-transform duration-500 ease-out group-hover:scale-110">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    sizes="(max-width: 768px) 48px, 68px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <span className="text-primary font-semibold text-xl md:text-2xl">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="mt-2 text-[11px] md:text-[13px] text-center text-ink font-semibold group-hover:text-primary transition-colors line-clamp-2 leading-tight">
              {c.name}
            </span>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}
