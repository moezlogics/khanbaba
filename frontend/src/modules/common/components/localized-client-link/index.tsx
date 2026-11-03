"use client"

import Link from "next/link"
import React from "react"

/**
 * Use this component to create a Next.js `<Link />` with clean URLs.
 * Pakistan-only store — no country code prefix needed in URLs.
 * The middleware handles internal rewrites to /pk/... automatically.
 */
/**
 * PREFETCH: intentionally left at Next's own default (`null`) rather than
 * the `false` this used to hard-code.
 *
 * In the App Router `prefetch={false}` does NOT mean "prefetch on hover
 * instead" for everyone — it means no viewport prefetch at all, and hover
 * is the only trigger left. Phones have no hover, so on mobile (most of
 * this store's traffic) every tap paid the full round-trip for the route
 * payload before anything could render, which is what made navigation
 * feel slow even though the pages themselves are fast.
 *
 * With the default, links prefetch as they enter the viewport, so the
 * payload is usually already in the router cache by the time the shopper
 * taps. The catalog routes are ISR, so those prefetches are served from
 * the cache rather than re-rendering — and once the CDN cache rule is in
 * place they never reach the origin at all.
 */
const LocalizedClientLink = ({
  children,
  href,
  prefetch,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  /** `null`/omitted = Next's default (viewport prefetch). */
  prefetch?: boolean | null
  [x: string]: any
}) => {
  return (
    <Link href={href} prefetch={prefetch} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
