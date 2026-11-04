"use client"

/**
 * Full-width search pill under the mobile header (the WordPress site had
 * one in the same place). It only opens the existing full-screen search:
 * the desktop LazySearchBar is mounted (CSS-hidden) on mobile too, listens
 * for `open-mobile-search` and portals its overlay into <body>. Keeping
 * this a plain button means no search code ships until someone taps it.
 */
export default function MobileSearchPill() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-mobile-search"))}
      className="w-full h-10 flex items-center gap-2.5 px-3.5 rounded-full border border-line bg-surface text-left text-[13px] text-ink/50 active:scale-[0.99] transition-transform"
      aria-label="Search products"
    >
      <i className="ph ph-magnifying-glass text-[17px] text-ink/60" aria-hidden />
      <span className="truncate">Search chilgoza, badam, dates…</span>
    </button>
  )
}
