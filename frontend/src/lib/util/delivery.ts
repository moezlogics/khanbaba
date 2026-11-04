/**
 * Delivery terms shown on the storefront. They mirror the backend shipping
 * option created by api/src/scripts/import-catalog.ts (flat fee, free from
 * a threshold) — change both together. Checkout itself always charges what
 * the backend says; these only drive copy and the PDP nudge.
 */
export const DELIVERY_FEE = 199
export const FREE_DELIVERY_FROM = 3000
/** Working days from order to doorstep, nationwide. */
export const DELIVERY_DAYS = { min: 2, max: 4 }

const fmt = new Intl.DateTimeFormat("en-PK", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Karachi",
})

/**
 * "Thu, 6 Nov – Sat, 8 Nov" for an order placed `from`. Sundays are not
 * counted as delivery days.
 */
export function deliveryWindow(from: Date = new Date()): string {
  const addWorkingDays = (start: Date, days: number) => {
    const d = new Date(start)
    let left = days
    while (left > 0) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0) left--
    }
    return d
  }
  return `${fmt.format(addWorkingDays(from, DELIVERY_DAYS.min))} – ${fmt.format(
    addWorkingDays(from, DELIVERY_DAYS.max)
  )}`
}
