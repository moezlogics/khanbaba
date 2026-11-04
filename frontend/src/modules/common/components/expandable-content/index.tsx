"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Long text clamped to `collapsedHeight` behind a fade, with a
 * "Read more" toggle (the Shopify way to keep an SEO article from
 * dominating a page). All of the content is in the server HTML either
 * way, so search engines read it in full. The toggle only appears when
 * the content is actually taller than the clamp.
 */
export default function ExpandableContent({
  children,
  collapsedHeight = 260,
  moreLabel = "Read more",
  lessLabel = "Show less",
}: {
  children: React.ReactNode
  collapsedHeight?: number
  moreLabel?: string
  lessLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight > collapsedHeight + 24)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsedHeight])

  const clamped = overflows && !open

  return (
    <div>
      <div
        ref={ref}
        className="relative overflow-hidden transition-[max-height] duration-500"
        style={{ maxHeight: clamped ? collapsedHeight : undefined }}
      >
        {children}
        {clamped && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent"
            aria-hidden
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
        >
          {open ? lessLabel : moreLabel}
          <i className={`ph-bold ph-caret-down text-[12px] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
    </div>
  )
}
