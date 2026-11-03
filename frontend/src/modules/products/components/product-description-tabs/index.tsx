"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import dynamic from "next/dynamic"

const DynamicProductReviews = dynamic(() => import("@modules/products/components/product-reviews"), { ssr: false })

type Props = {
  /** Legacy single rich-description (back-compat). */
  richDescription?: string | null
  /** English rich description from `metadata.rich_description_en`. */
  richDescriptionEn?: string | null
  /** Urdu rich description from `metadata.rich_description_ur` (RTL). */
  richDescriptionUr?: string | null
  /** Plain-text fallback when no rich content is available. */
  plainDescription?: string | null
  /** ProductReviews slot — passed as children to keep server/client clean. */
  reviewsSlot?: React.ReactNode
  productId?: string
  productTitle?: string
  /** Number to render in the Reviews nav badge. */
  reviewCount?: number
}

type SectionKey = "english" | "urdu" | "reviews"

/**
 * Sequential product detail sections with sticky navigation.
 *
 * All sections (Description, اردو, Reviews) render
 * sequentially on one page. A sticky navigation bar at the top
 * highlights the current section and clicking a nav item smooth-scrolls
 * to that section.
 *
 * Uses IntersectionObserver to track which section is in view and
 * highlight the corresponding nav item.
 */
export default function ProductDescriptionTabs({
  richDescription,
  richDescriptionEn,
  richDescriptionUr,
  plainDescription,
  reviewsSlot,
  reviewCount,
  productId,
  productTitle,
}: Props) {
  const englishHtml = (richDescriptionEn ?? richDescription)?.trim() || null
  const urduHtml = richDescriptionUr?.trim() || null
  const hasEnglish = !!(englishHtml || plainDescription)
  const hasUrdu = !!urduHtml

  // Build list of visible sections
  const sections = useMemo(() => {
    const s: { key: SectionKey; label: string; lang?: string }[] = []
    if (hasEnglish) s.push({ key: "english", label: "Description" })
    if (hasUrdu) s.push({ key: "urdu", label: "اردو", lang: "ur" })
    s.push({ key: "reviews", label: "Reviews" })
    return s
  }, [hasEnglish, hasUrdu])

  const [activeSection, setActiveSection] = useState<SectionKey>(
    sections[0]?.key || "reviews"
  )
  const [headerHeight, setHeaderHeight] = useState(0)

  const navRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const isScrollingRef = useRef(false)

  // Measure the sticky site header height so our nav sticks below it
  useEffect(() => {
    const header = document.getElementById("header")
    if (!header) return

    const measure = () => setHeaderHeight(header.offsetHeight)
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  // Assign a ref to a section
  const setSectionRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      sectionRefs.current[key] = el
    },
    []
  )

  // Total offset = header + nav bar
  const totalOffset = headerHeight + (navRef.current?.offsetHeight || 44)

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visibleSections = new Map<string, number>()

    for (const section of sections) {
      const el = sectionRefs.current[section.key]
      if (!el) continue

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (isScrollingRef.current) return

          if (entry.isIntersecting) {
            visibleSections.set(section.key, entry.intersectionRatio)
          } else {
            visibleSections.delete(section.key)
          }

          // Pick the section with highest intersection ratio, or fall
          // back to document order if ratios are equal
          if (visibleSections.size > 0) {
            let best: string | null = null
            let bestRatio = -1
            for (const s of sections) {
              const ratio = visibleSections.get(s.key)
              if (ratio !== undefined && ratio >= bestRatio) {
                // For equal ratios, prefer the first one in document order
                if (ratio > bestRatio || best === null) {
                  best = s.key
                  bestRatio = ratio
                }
              }
            }
            if (best) setActiveSection(best as SectionKey)
          }
        },
        {
          rootMargin: `-${totalOffset + 20}px 0px -60% 0px`,
          threshold: [0, 0.1, 0.25, 0.5],
        }
      )
      observer.observe(el)
      observers.push(observer)
    }

    return () => observers.forEach((o) => o.disconnect())
  }, [sections])

  // Hash navigation: #reviews / #description (rating link, mobile sticky bar)
  useEffect(() => {
    const target = (hash: string): SectionKey | null =>
      hash === "#reviews" ? "reviews" : hash === "#description" ? "english" : null

    const fromHash = target(window.location.hash)
    if (fromHash) scrollToSection(fromHash)

    const handleHashChange = () => {
      const key = target(window.location.hash)
      if (key) scrollToSection(key)
    }
    window.addEventListener("hashchange", handleHashChange)

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href="#reviews"], a[href="#description"]')
      if (!link) return
      const key = target(link.getAttribute("href") || "")
      if (!key) return
      e.preventDefault()
      scrollToSection(key)
    }
    document.addEventListener("click", handleClick)
    return () => {
      window.removeEventListener("hashchange", handleHashChange)
      document.removeEventListener("click", handleClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToSection = (key: string) => {
    const el = sectionRefs.current[key]
    if (!el) return

    isScrollingRef.current = true
    setActiveSection(key as SectionKey)

    // Account for sticky header + sticky nav bar height
    const header = document.getElementById("header")
    const hHeight = header?.offsetHeight || 0
    const navHeight = navRef.current?.offsetHeight || 44
    const y = el.getBoundingClientRect().top + window.scrollY - hHeight - navHeight - 8

    window.scrollTo({ top: y, behavior: "smooth" })

    // Re-enable observer tracking after scroll settles
    setTimeout(() => {
      isScrollingRef.current = false
    }, 800)
  }

  const navBtnCls = (isActive: boolean) =>
    `relative px-4 py-2.5 text-[13.5px] whitespace-nowrap transition-colors ${
      isActive
        ? "text-black font-bold"
        : "text-black/70 hover:text-black font-medium"
    }`

  return (
    <div className="w-full">
      {/* Sticky navigation bar — sticks below the site header */}
      <div
        ref={navRef}
        className="sticky z-30 bg-white/95 backdrop-blur-sm border-b border-line shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200"
        style={{ top: `${headerHeight}px` }}
        role="navigation"
        aria-label="Product sections"
      >
        <div
          className="flex items-center gap-0 overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => scrollToSection(s.key)}
              className={navBtnCls(activeSection === s.key)}
              {...(s.lang ? { lang: s.lang } : {})}
            >
              {s.label}
              {s.key === "reviews" &&
                typeof reviewCount === "number" &&
                reviewCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {reviewCount}
                  </span>
                )}
              {activeSection === s.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* All sections rendered sequentially */}
      <div className="flex flex-col">
        {/* Description — English */}
        {hasEnglish && (
          <div
            ref={setSectionRef("english")}
            id="section-description"
            className="pt-6 pb-8 scroll-mt-20"
          >
            <h2 className="text-[15px] md:text-base font-bold text-black mb-4 flex items-center gap-2">
              <i className="ph-bold ph-article text-primary text-[18px]" aria-hidden />
              Description
            </h2>
            <div
              lang="en"
              className="prose prose-sm md:prose-base max-w-4xl text-ink/80 leading-relaxed prose-strong:font-semibold prose-headings:font-semibold prose-headings:text-ink prose-a:text-primary"
            >
              {englishHtml ? (
                <div dangerouslySetInnerHTML={{ __html: englishHtml }} />
              ) : (
                <p className="whitespace-pre-line">{plainDescription}</p>
              )}
            </div>
          </div>
        )}

        {/* Description — Urdu */}
        {hasUrdu && (
          <div
            ref={setSectionRef("urdu")}
            id="section-urdu"
            className="pt-6 pb-8 border-t border-line/50 scroll-mt-20"
          >
            <h2
              className="text-[15px] md:text-base font-bold text-black mb-4 flex items-center gap-2"
              lang="ur"
              dir="rtl"
            >
              <i className="ph-bold ph-article text-primary text-[18px]" aria-hidden />
              اردو تفصیل
            </h2>
            <div
              lang="ur"
              dir="rtl"
              className="prose prose-sm max-w-none text-ink/80 leading-loose font-[400] text-right prose-strong:font-semibold prose-headings:font-semibold"
            >
              <div dangerouslySetInnerHTML={{ __html: urduHtml! }} />
            </div>
          </div>
        )}

        {/* Reviews */}
        <div
          ref={setSectionRef("reviews")}
          id="section-reviews"
          className="pt-6 pb-8 border-t border-line/50 scroll-mt-20"
        >
          <h2 className="text-[15px] md:text-base font-bold text-black mb-4 flex items-center gap-2">
            <i className="ph-bold ph-star text-primary text-[18px]" aria-hidden />
            Reviews
            {typeof reviewCount === "number" && reviewCount > 0 && (
              <span className="inline-flex items-center justify-center h-[22px] min-w-[22px] px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                {reviewCount}
              </span>
            )}
          </h2>
          {reviewsSlot || (productId && (
            <DynamicProductReviews productId={productId} productTitle={productTitle} />
          ))}
        </div>
      </div>
    </div>
  )
}
