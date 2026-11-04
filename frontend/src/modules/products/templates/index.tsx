import React, { Suspense } from "react"
import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ImageGalleryBridge from "@modules/products/components/image-gallery/gallery-bridge"
import ProductLcpImage from "@modules/products/components/product-lcp-image"
import ProductActions from "@modules/products/components/product-actions"
import ProductPreview from "@modules/products/components/product-preview"
import ProductDescriptionTabs from "@modules/products/components/product-description-tabs"
import BundleCard from "@modules/products/components/bundle-card"
import ProductInfo from "@modules/products/templates/product-info"
import ProductViewTracker from "@modules/analytics/product-view-tracker"
import { listProducts } from "@lib/data/products"
import { getProductReviewStats, getProductReviewsForJsonLd } from "@lib/data/reviews"
import { buildAltMap } from "@lib/data/cdn-meta"
import { getBundlesForProduct } from "@lib/data/bundles"
import { getSiteSettings, resolveProductCardAspectClass } from "@lib/data/site-settings"
import { getProductPrice } from "@lib/util/get-product-price"
import { getProductPath } from "@lib/util/product"
import { canonicalUrl } from "@lib/util/seo-url"
import { getBaseURL } from "@lib/util/env"
import { slimProductForClient } from "@lib/util/slim-product"
import { PRODUCT_CARD_FIELDS } from "@lib/util/product-card-fields"

const FrequentlyBoughtTogether = dynamic(
  () => import("@modules/products/components/frequently-bought-together")
)

// Delivery as configured on the backend shipping option (see
// api/src/scripts/import-catalog.ts) — kept in step for the Offer schema.
const DELIVERY_FEE = 199
// The store's own CDN — images from it can go through /_next/image.
const CDN_ORIGIN = (process.env.NEXT_PUBLIC_CDN_URL || "").replace(/\/+$/, "")

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

function isAvailable(product: HttpTypes.StoreProduct): boolean {
  return (product.variants ?? []).some((v: any) => {
    if (v.allow_backorder) return true
    if (v.manage_inventory === false) return true
    return typeof v.inventory_quantity === "number" && v.inventory_quantity > 0
  })
}

/**
 * Khan Baba product page — the itwarbazar layout on zmobile's engine:
 *
 *   breadcrumb
 *   [ gallery + thumbnails ]  [ title · rating · short description
 *                               size chips · stock · price · quantity
 *                               Buy Now | Add to Cart · WhatsApp
 *                               trust tiles ]
 *   Description · Reviews (sticky section nav)
 *   You may also like
 *
 * Kept from zmobile for speed: the LCP image is server-rendered and
 * preloaded, the page stays ISR-cacheable (size selection runs client-side
 * through ?v_id), and client components get a slimmed product without the
 * rich-description blobs.
 */
const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  const currency =
    product.variants?.[0]?.calculated_price?.currency_code || region.currency_code
  const primaryCategory = product.categories?.[0]

  const [stats, reviews, bundles, altMap, settings, relatedResult] = await Promise.all([
    getProductReviewStats(product.id).catch(() => null),
    getProductReviewsForJsonLd(product.id, 10).catch(() => []),
    getBundlesForProduct(product.id, currency, region.id).catch(() => []),
    // CDN-generated alt text for each gallery image.
    buildAltMap(
      (images || []).filter((i) => !!i?.url) as Array<{ url: string }>,
      product.title || "Product image"
    ).catch(() => ({} as Record<string, string>)),
    getSiteSettings().catch(() => ({} as Record<string, string | undefined>)),
    listProducts({
      queryParams: {
        limit: 12,
        fields: PRODUCT_CARD_FIELDS,
        ...(primaryCategory?.id ? { category_id: [primaryCategory.id] } : {}),
      } as any,
      countryCode,
    }).catch(() => ({ response: { products: [] as HttpTypes.StoreProduct[] } })),
  ])

  const aspectRatioClass = resolveProductCardAspectClass(settings || {})
  const siteName = (settings as any).site_name?.trim() || "Khan Baba"

  // ONE slim copy of the product for all client components (no rich
  // description blobs in the flight payload).
  const clientProduct = slimProductForClient(product)

  // ?v_id=… narrows the gallery to a variant's images CLIENT-side (an ISR
  // page cannot read the query string server-side).
  const variantImageIds: Record<string, string[]> = {}
  for (const v of product.variants ?? []) {
    const ids = ((v as any).images ?? []).map((i: any) => i?.id).filter(Boolean)
    if (ids.length > 0) variantImageIds[v.id] = ids
  }

  const shortDescription = (product.metadata as any)?.short_description as string | undefined
  const whatsappNumber = (settings as any).whatsapp_number?.trim() || undefined
  const whatsappBuyNowEnabled = (settings as any).whatsapp_buy_now_enabled !== "false"

  const galleryAltFallback = product.title || "Product image"
  const lcpImageUrl = (images || []).find((i) => !!i?.url)?.url || product.thumbnail || null
  const lcpImageAlt = (lcpImageUrl && altMap?.[lcpImageUrl]) || galleryAltFallback

  const galleryFallback = lcpImageUrl ? (
    <ProductLcpImage src={lcpImageUrl} alt={lcpImageAlt} aspectRatioClass={aspectRatioClass} />
  ) : (
    <div className={`${aspectRatioClass} w-full bg-surface rounded-[var(--radius-card)]`} aria-hidden />
  )

  // "You may also like": same category first, topped up from the whole
  // catalogue when the category is small (most Khan Baba categories hold
  // 1–4 products).
  let related = (relatedResult.response.products || []).filter((p) => p.id !== product.id)
  if (related.length < 5) {
    const more = await listProducts({
      queryParams: { limit: 12, fields: PRODUCT_CARD_FIELDS } as any,
      countryCode,
    })
      .then(({ response }) => response.products)
      .catch(() => [] as HttpTypes.StoreProduct[])
    const seen = new Set([product.id, ...related.map((p) => p.id)])
    related = related.concat(more.filter((p) => !seen.has(p.id)))
  }
  related = related.slice(0, 5)

  /* ---------------- structured data ---------------- */

  const productUrl = canonicalUrl(getProductPath(product))
  const cheapest = getProductPrice({ product }).cheapestPrice
  const price = cheapest?.calculated_price_number
  const v0: any = product.variants?.[0] || {}

  const priceValidUntil = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const offer: Record<string, any> | undefined = price
    ? {
        "@type": "Offer",
        priceCurrency: (currency || "PKR").toUpperCase(),
        price,
        url: productUrl,
        availability: isAvailable(product)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        priceValidUntil,
        seller: { "@id": `${getBaseURL()}/#organization` },
        // The real policy (/refund-policy): damaged, expired or incorrect
        // items reported within 24 hours; no change-of-mind returns.
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "PK",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 1,
          returnFees: "https://schema.org/FreeReturn",
        },
        // Flat Rs 199 (free from Rs 3,000 — not expressible per product).
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: DELIVERY_FEE,
            currency: (currency || "PKR").toUpperCase(),
          },
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4, unitCode: "DAY" },
          },
        },
      }
    : undefined

  const ldjson: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.subtitle || undefined,
    image: images?.map((i) => i.url).filter(Boolean) || [],
    sku: v0.sku || undefined,
    ...(v0.weight ? { weight: { "@type": "QuantitativeValue", value: v0.weight, unitCode: "GRM" } } : {}),
    ...(primaryCategory?.name && { category: primaryCategory.name }),
    // Khan Baba sells under its own name.
    brand: { "@type": "Brand", name: siteName },
    offers: offer,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": productUrl,
      ...(product.created_at && { datePublished: new Date(product.created_at).toISOString() }),
      ...(product.updated_at && { dateModified: new Date(product.updated_at).toISOString() }),
    },
  }

  // Ratings/reviews only when they are real — never fabricated.
  if (stats && stats.reviewCount > 0) {
    ldjson.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: stats.averageRating.toFixed(1),
      reviewCount: stats.reviewCount,
      bestRating: "5",
      worstRating: "1",
    }
  }
  if (reviews && reviews.length > 0) {
    ldjson.review = reviews.map((r) => {
      const customerName = r.customer?.first_name
        ? `${r.customer.first_name} ${r.customer.last_name || ""}`.trim()
        : null
      return {
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: "5", worstRating: "1" },
        author: { "@type": "Person", name: customerName || r.guest_name || "Anonymous" },
        reviewBody: r.content,
        datePublished: r.created_at,
      }
    })
  }

  // Preload the LCP image with the same srcset <ProductLcpImage> renders,
  // so the browser treats both as one resource.
  const lcpPreload = (() => {
    if (!lcpImageUrl) return null
    const optimizable =
      !lcpImageUrl.startsWith("data:") &&
      (lcpImageUrl.startsWith("/") ||
        (!!CDN_ORIGIN && lcpImageUrl.startsWith(CDN_ORIGIN)) ||
        lcpImageUrl.startsWith("http://localhost"))
    const imgSrcSet = optimizable
      ? [640, 828, 1080]
          .map((w) => {
            const p = new URLSearchParams({ url: lcpImageUrl, w: String(w), q: "75" })
            return `/_next/image?${p.toString()} ${w}w`
          })
          .join(", ")
      : undefined
    return (
      <link
        rel="preload"
        as="image"
        href={lcpImageUrl}
        // @ts-expect-error — imagesrcset / imagesizes are valid but not yet in React's types
        imagesrcset={imgSrcSet}
        imagesizes="(min-width: 1024px) 560px, 100vw"
        fetchPriority="high"
      />
    )
  })()

  return (
    <>
      {lcpPreload}

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson).replace(/</g, "\\u003c") }}
      />

      <ProductViewTracker
        productId={product.id}
        productTitle={product.title || ""}
        category={primaryCategory?.name}
        price={price ?? undefined}
        currency={currency}
      />

      <div className="container-anvogue pt-2 small:pt-4">
        <ProductInfo product={product} mode="top" />
      </div>

      <div className="container-anvogue pt-3 pb-6 small:py-6" data-testid="product-container">
        <div className="grid grid-cols-1 small:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-5 small:gap-10 items-start">
          <div className="w-full small:sticky small:top-24">
            <Suspense fallback={galleryFallback}>
              <ImageGalleryBridge
                images={images}
                altMap={altMap}
                altFallback={galleryAltFallback}
                aspectRatioClass={aspectRatioClass}
                variantImageIds={variantImageIds}
                priority
              />
            </Suspense>
          </div>

          <div className="w-full flex flex-col gap-5 small:max-w-[560px]">
            <ProductInfo product={product} mode="main" />
            <ProductActions
              product={clientProduct}
              region={region}
              whatsappNumber={whatsappNumber}
              whatsappBuyNowEnabled={whatsappBuyNowEnabled}
            />
            {bundles && bundles.length > 0 && <BundleCard bundles={bundles} />}
            {/* WordPress "short description" — below the buy box so the
                price and buttons stay near the top on phones. */}
            {shortDescription && (
              <div className="rounded-[var(--radius-btn)] border border-line p-4">
                <p className="mb-1.5 text-[13px] font-bold text-ink">About this product</p>
                <div
                  className="text-[13.5px] text-ink/70 leading-relaxed [&_p]:my-1 [&_a]:text-primary"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: shortDescription }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* #reviews / #description anchors are handled by the section nav. */}
      <div id="reviews" className="container-anvogue my-4 small:my-8 scroll-mt-16">
        <ProductDescriptionTabs
          richDescription={(product.metadata as any)?.rich_description || null}
          richDescriptionEn={(product.metadata as any)?.rich_description_en || null}
          richDescriptionUr={(product.metadata as any)?.rich_description_ur || null}
          plainDescription={product.description || product.subtitle || null}
          reviewCount={stats?.reviewCount}
          productId={product.id}
          productTitle={product.title}
        />
      </div>

      {related.length > 0 && (
        <section className="container-anvogue pb-10">
          <h2 className="text-[22px] small:text-[30px] font-semibold text-ink mb-4">
            You may also like
          </h2>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar small:mx-0 small:grid small:grid-cols-4 small:gap-x-5 small:gap-y-4 small:overflow-visible small:px-0 medium:grid-cols-5">
            {related.map((p, i) => (
              <li
                key={p.id}
                className={`w-[44%] shrink-0 snap-start xsmall:w-[30%] small:w-auto ${i >= 4 ? "small:hidden medium:block" : ""}`}
              >
                <ProductPreview region={region} product={p} aspectClass={aspectRatioClass} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Suspense fallback={null}>
        <FrequentlyBoughtTogether product={product} countryCode={countryCode} />
      </Suspense>
    </>
  )
}

export default ProductTemplate
