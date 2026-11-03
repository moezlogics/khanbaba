import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// Backend URL resolution — CRITICAL for archive/listing page speed.
//
// The SDK runs in BOTH the browser and the Next.js server. The browser MUST
// use the PUBLIC url (a browser can't reach the server's localhost). The
// SERVER should talk to the backend DIRECTLY over localhost/internal — NOT
// loop its requests back out through the public domain + Cloudflare. That
// round-trip was adding ~1-3s to every server-side fetch (product lists,
// filters, pagination on /store, brand, collection, category pages), which
// is exactly why archive pages felt slow while the heavily-cached homepage
// did not.
//
// Only NEXT_PUBLIC_* vars are inlined into the client bundle, so on the
// client `MEDUSA_BACKEND_URL` (non-public) is undefined and we fall back to
// the public url automatically.
const PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "https://api.khanbaba.pk"
const INTERNAL_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || PUBLIC_BACKEND_URL

const MEDUSA_BACKEND_URL =
  typeof window === "undefined" ? INTERNAL_BACKEND_URL : PUBLIC_BACKEND_URL

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

const HIDDEN_PRODUCT_IDS = new Set([
  "prod_01KVAAJ903PZ4WY757XES1JJ6T",
  "prod_01KVAA24X1ZTKAE5JG47YW9QE0",
  "prod_01KVA9P34AFCZTTBZABWGT0XPJ",
  "prod_01KVA9BZT07941A8G859PZVC3C"
])

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const res = await originalFetch(input, init)

  if (res && typeof res === "object") {
    const rawRes = res as any
    if ("products" in rawRes && Array.isArray(rawRes.products)) {
      const originalLen = rawRes.products.length
      rawRes.products = rawRes.products.filter(
        (p: any) => p && p.id && !HIDDEN_PRODUCT_IDS.has(p.id)
      )
      const removedCount = originalLen - rawRes.products.length
      if (removedCount > 0 && typeof rawRes.count === "number") {
        rawRes.count = Math.max(0, rawRes.count - removedCount)
      }
    }
    if ("product" in rawRes && rawRes.product && typeof rawRes.product === "object") {
      if (rawRes.product.id && HIDDEN_PRODUCT_IDS.has(rawRes.product.id)) {
        rawRes.product = null
      }
    }
  }

  return res as T
}