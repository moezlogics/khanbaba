import { NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:8042"

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

const STORE_HEADERS: Record<string, string> = PUBLISHABLE_KEY
  ? { "x-publishable-api-key": PUBLISHABLE_KEY }
  : {}

export async function GET() {
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/products?limit=2000&fields=id,title,handle,thumbnail,description,*categories`,
      {
        headers: STORE_HEADERS,
        next: { tags: ["products-search"], revalidate: 600 }, // 10 minutes cache
      }
    )
    if (!res.ok) {
      console.error("[products-search-api] Backend returned non-200 status:", res.status, res.statusText)
      return NextResponse.json({ products: [] })
    }
    const { products } = await res.json()
    const productList = (products || []).filter((p: any) => p && p.id)

    return NextResponse.json({ products: productList })
  } catch (error) {
    console.error("[products-search-api] failed to fetch products", error)
    return NextResponse.json({ products: [] }, { status: 500 })
  }
}
