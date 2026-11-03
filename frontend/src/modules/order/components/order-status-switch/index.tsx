"use client"

import React, { useEffect, useState } from "react"

/**
 * Store-wide "out of stock" mode for the order confirmation page.
 *
 * Only rendered when the `order_out_of_stock_mode` site setting is on — a
 * temporary switch for while the whole catalogue is genuinely out of
 * stock. It must be turned off once stock returns, otherwise real,
 * fulfillable orders would be shown as canceled too.
 *
 *   first look at the page          → "awaiting" (the order was received)
 *   any later look at the same order → "canceled" (out of stock)
 *
 * "Later" means this browser has already shown the page for this order, OR
 * the order is older than REVISIT_AFTER_MS. The age rule keeps the result
 * consistent when the customer comes back on another device or in a
 * private window, where there is no stored flag.
 */

const REVISIT_AFTER_MS = 30 * 60 * 1000

type View = "awaiting" | "canceled"

// The page renders two switches (the hero and the tracker). Both must
// reach the SAME answer, but the first one records the visit — so the
// decision is made once per order per page load and then reused, instead
// of the second switch reading the flag the first one just wrote.
const decisions = new Map<string, View>()

function decide(orderId: string, createdAt?: string | null): View {
  const cached = decisions.get(orderId)
  if (cached) return cached

  const key = `order-seen:${orderId}`
  let seenBefore = false
  try {
    seenBefore = window.localStorage.getItem(key) === "1"
  } catch {
    /* storage blocked — fall back to the age rule */
  }

  const createdMs = createdAt ? Date.parse(createdAt) : NaN
  const isOld = Number.isFinite(createdMs) && Date.now() - createdMs > REVISIT_AFTER_MS

  const view: View = seenBefore || isOld ? "canceled" : "awaiting"
  decisions.set(orderId, view)

  try {
    window.localStorage.setItem(key, "1")
  } catch {
    /* ignore */
  }
  return view
}

export default function OrderStatusSwitch({
  orderId,
  createdAt,
  awaiting,
  canceled,
  placeholderClassName = "min-h-[240px]",
}: {
  orderId: string
  createdAt?: string | null
  awaiting: React.ReactNode
  canceled: React.ReactNode
  /** Reserves space until the client decides, to avoid a layout jump. */
  placeholderClassName?: string
}) {
  // Rendered empty on the server and on the first client pass so there is
  // no hydration mismatch and no flash of the wrong state before switching.
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    setView(decide(orderId, createdAt))
  }, [orderId, createdAt])

  if (!view) {
    return <div className={placeholderClassName} aria-busy="true" />
  }

  return <div className="animate-enter">{view === "canceled" ? canceled : awaiting}</div>
}
