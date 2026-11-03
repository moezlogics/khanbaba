import { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"

import { getCategoryByHandle } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import { getSiteSettings } from "@lib/data/site-settings"
import { listProducts } from "@lib/data/products"
import { canonicalUrl, seoText } from "@lib/util/seo-url"
import { htmlToText } from "@lib/util/html-text"
import { buildCategoryPath, buildCategoryChain } from "@lib/util/category-path"
import { getImagesForVariant } from "@lib/util/product"


import ProductTemplate from "@modules/products/templates"
import CategoryTemplate from "@modules/categories/templates"
import BreadcrumbJsonLd from "@modules/common/components/breadcrumb-jsonld"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

// ISR: the shared page shell (product / category) is rendered once
// per path and cached for 5 minutes; the backend revalidation subscriber
// purges tags on admin changes for near-instant freshness.
//
// The three previously-proven ISR blockers are all gone:
//  1. no cookies() anywhere in this render tree (layouts + SDK wrapper are
//     cookie-free; per-user UI hydrates client-side via UserDataProvider)
//  2. searchParams is NEVER awaited on the server — v_id gallery selection
//     and archive filters/sort/pagination are applied client-side
//  3. no `cache: "no-store"` fetch in this tree
export const revalidate = 300
type Props = {
  params: Promise<{ slug: string[]; countryCode: string }>
  // NOTE: searchParams intentionally NOT declared/read — awaiting it marks
  // the route dynamic and 500s ISR (proven via runtime logs).
}

/**
 * Bulletproof Next.js / SWC Compiler tree-shaking workaround.
 * In Next.js, when a page module has multiple split entry points (e.g. generateMetadata,
 * generateStaticParams, default export SlugPage), the compiler can tree-shake top-level
 * imports that are used only in one of the exports, leading to runtime "ReferenceError: X is not defined"
 * crashes. Exporting a constant referencing these imported utilities forces the compiler
 * to bundle and keep the references alive.
 */
export const _nextJsCompilerWorkaround = {
  buildCategoryChain,
  getImagesForVariant,
}

export async function generateStaticParams() {
  // Return empty array to prevent build failures when backend or publishable keys are missing/offline.
  // Routes will resolve dynamically at runtime.
  return []
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { slug: segments, countryCode } = params
  if (!segments || segments.length === 0) notFound()
  const lastSegment = segments[segments.length - 1]

  // Filtered/sorted URLs (?spec_*, ?sortBy, ?page …) are noindexed via an
  // X-Robots-Tag header in middleware — query strings are invisible to an
  // ISR render, so robots handling cannot live here anymore.

  // 1. Try Product Match
  const product = await listProducts({
    countryCode,
    queryParams: { handle: lastSegment, limit: 1 },
  }).then(({ response }) => response.products[0]).catch(() => null)

  if (product) {
    // Independent lookups — run in parallel (they were sequential, adding
    // 2 extra serialized backend roundtrips to EVERY product page render).
    const [region, settings] = await Promise.all([
      getRegion(countryCode),
      getSiteSettings(),
    ])
    if (!region) notFound()

    const description =
      product.description?.slice(0, 160) ||
      product.subtitle ||
      `Shop ${product.title} at ${settings.site_name || "our store"}.`

    const images = [
      product.thumbnail,
      ...(product.images?.map((i) => i.url) || []),
    ].filter((v): v is string => !!v)

    const seoTitle = seoText(
      (product.metadata as any)?.meta_title || (product.metadata as any)?.seo_title || product.title
    )
    const seoDescription = seoText(
      (product.metadata as any)?.meta_description || (product.metadata as any)?.seo_description || description
    )

    const { getProductPath } = await import("@lib/util/product")
    const canonical = canonicalUrl(getProductPath(product))


    const firstVariant = product.variants?.[0]
    const price = firstVariant?.calculated_price?.calculated_amount
    const currency =
      firstVariant?.calculated_price?.currency_code || region.currency_code
    const gtinForOg =
      (product.metadata as any)?.gtin13 ||
      (product.metadata as any)?.gtin ||
      (firstVariant as any)?.barcode
    // Khan Baba sells under its own name, so that is the brand Google sees.
    const brandForOg = (product.metadata as any)?.brand || settings.site_name

    const ogProduct: Record<string, string> = {
      "og:type": "product",
      ...(price && {
        "product:price:amount": String(price),
        "product:price:currency": (currency || "PKR").toUpperCase(),
      }),
      "product:availability": (product.variants ?? []).some(
        (v: any) =>
          v.allow_backorder ||
          v.manage_inventory === false ||
          (typeof v.inventory_quantity === "number" && v.inventory_quantity > 0)
      )
        ? "in stock"
        : "out of stock",
      "product:condition": "new",
      "product:retailer_item_id": firstVariant?.sku || product.id,
      ...(gtinForOg && { "product:retailer_part_no": String(gtinForOg) }),
      ...(brandForOg && { "product:brand": String(brandForOg) }),
      ...(product.categories?.[0]?.name && {
        "product:category": product.categories[0].name,
      }),
      // Real system timestamps — ensures Google indexes the actual
      // creation/modification dates instead of spec metadata (launch_date).
      ...(product.created_at && {
        "article:published_time": new Date(product.created_at).toISOString(),
        "publish-date": new Date(product.created_at).toISOString(),
        "pubdate": new Date(product.created_at).toISOString(),
        "date": new Date(product.created_at).toISOString(),
      }),
      ...(product.updated_at && {
        "article:modified_time": new Date(product.updated_at).toISOString(),
        "last-modified": new Date(product.updated_at).toISOString(),
        "revised": new Date(product.updated_at).toISOString(),
        "og:updated_time": new Date(product.updated_at).toISOString(),
      }),
    }

    return {
      title: seoTitle,
      description: seoDescription,
      openGraph: {
        title: seoTitle,
        description: seoDescription,
        type: "website",
        url: canonical,
        images: images.slice(0, 4),
      },
      twitter: {
        card: "summary_large_image",
        title: seoTitle,
        description: seoDescription,
        images: images.slice(0, 1),
      },
      alternates: {
        canonical,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      other: ogProduct,
    }
  }

  // 2. Try Category Match
  try {
    const productCategory = await getCategoryByHandle(segments)
    if (!productCategory) notFound()
    const meta = (productCategory as any).metadata || {}
    const title = seoText(meta.meta_title?.trim() || productCategory.name)
    const description = seoText(
      meta.meta_description?.trim() ||
        productCategory.description ||
        `Shop ${productCategory.name}.`
    )
    const canonical = canonicalUrl(`/${segments.join("/")}`)
    const ogImage =
      (meta as any).og_image || (productCategory as any).metadata?.image || undefined

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonical,
        type: "website",
        ...(ogImage ? { images: [ogImage] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
      alternates: {
        canonical,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large" },
      },
    }
  } catch (error) {
    notFound()
  }
}

export default async function SlugPage(props: Props) {
  const params = await props.params
  const { slug: segments, countryCode } = params

  if (!segments || segments.length === 0) notFound()
  const lastSegment = segments[segments.length - 1]

  // Parallelize the product and category lookups to optimize TTFB
  const [pricedProduct, productCategory] = await Promise.all([
    listProducts({
      countryCode,
      queryParams: { handle: lastSegment, limit: 1 },
    }).then(({ response }) => response.products[0]).catch(() => null),
    getCategoryByHandle(segments).catch(() => null),
  ])

  if (pricedProduct) {
    const region = await getRegion(countryCode)
    if (!region) notFound()

    // All product images render server-side; the ?v_id variant selection
    // narrows the gallery CLIENT-side (an ISR page can't see the query).
    const images = pricedProduct.images ?? []
    const primaryCategory = pricedProduct.categories?.[0]
    const categoryChain = buildCategoryChain(primaryCategory)

    // FAQ JSON-LD carried over from the WordPress product content
    // (metadata.faq_schema) — the questions also appear in the description.
    const faqSchema = (pricedProduct.metadata as any)?.faq_schema

    return (
      <>
        <BreadcrumbJsonLd
          countryCode={countryCode}
          items={[
            { name: "Home", href: "/" },
            ...categoryChain.map((c) => ({
              name: c.name,
              href: `/${buildCategoryPath(c)}`,
            })),
            { name: pricedProduct.title },
          ]}
        />
        {faqSchema?.["@type"] === "FAQPage" && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c"),
            }}
          />
        )}
        <ProductTemplate
          product={pricedProduct}
          region={region}
          countryCode={countryCode}
          images={images}
        />
      </>
    )
  }

  // 2. Try Category Render
  if (productCategory) {
    const chain: any[] = []
    let cur: any = productCategory
    while (cur) {
      chain.unshift(cur)
      cur = cur.parent_category
    }

    return (
      <>
        <BreadcrumbJsonLd
          countryCode={countryCode}
          items={[
            { name: "Home", href: "/" },
            { name: "Shop", href: "/store" },
            ...chain.slice(0, -1).map((c) => ({
              name: c.name,
              href: `/${buildCategoryPath(c)}`,
            })),
            { name: productCategory.name },
          ]}
        />
        <CategoryTemplate
          category={productCategory}
          countryCode={countryCode}
        />
      </>
    )
  }

  notFound()
}
