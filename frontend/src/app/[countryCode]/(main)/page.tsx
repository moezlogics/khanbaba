import { Metadata } from "next"
import { Suspense } from "react"

import { GridSkeleton } from "@modules/skeletons/templates/page-skeletons"
import { getRegion } from "@lib/data/regions"
import { getSiteSettings } from "@lib/data/site-settings"
import { parseCategoryBar } from "@lib/util/category-bar"
import { listBanners } from "@lib/data/banners"
import { canonicalUrl, ROBOTS_INDEX } from "@lib/util/seo-url"
import HeroSlider from "@modules/home/components/hero-slider"
import ProductRail from "@modules/home/components/featured-products/product-rail"
import CategoryCarouselServer from "@modules/home/components/category-carousel/server"
import BenefitsStrip from "@modules/home/components/benefits-strip"
import BrandHero from "@modules/home/components/brand-hero"
import CustomerReviews from "@modules/home/components/customer-reviews"
import WholesaleBand from "@modules/home/components/wholesale-band"
import ExpandableContent from "@modules/common/components/expandable-content"
import { getLatestReviews } from "@lib/data/reviews"
import { listProducts } from "@lib/data/products"

// ── ISR: let the CDN hold the homepage ───────────────────────────────
// The homepage is anonymous and identical for every first-time visitor
// (catalog, banners, categories — no per-user content; cart badge + login
// state hydrate client-side via UserDataProvider). Without an explicit
// `revalidate`, Next renders it on-demand and stamps the response
// `private, no-store`, which OVERRIDES the `public, s-maxage=300` header
// the middleware sets for anonymous traffic — so Cloudflare returns
// Cf-Cache-Status: DYNAMIC and every first paint waits on a full origin
// render (~20 backend calls). ISR pre-renders the shared shell and lets
// the edge serve it; the PDP + collection routes already do exactly this.
// 5-min staleness for price/stock is acceptable (admin edits purge via
// revalidateTag). The layout is cookie-free and the SDK wrapper no longer
// reads cookies on render, so this route is static-safe (no 500).
export const revalidate = 300

/**
 * Homepage metadata comes from admin site-settings (SEO section) so operators
 * can update titles/descriptions without a redeploy. The root layout already
 * supplies default metadataBase + title template; this just refines the
 * homepage copy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings()
  const title = s.seo_home_title?.trim()
  const description = s.seo_home_description?.trim()
  const ogImage = s.seo_default_og_image?.trim()

  const home = canonicalUrl("/")

  const meta: Metadata = {
    // Homepage canonical mirrors the root URL — no `/<countryCode>` prefix
    // (the middleware adds that internally; the public URL never shows
    // it). Without this Google has nothing to consolidate against and
    // www / non-www / query-string variants compete for the same signal.
    alternates: { canonical: home },
    robots: ROBOTS_INDEX,
  }
  if (title) meta.title = title
  if (description) meta.description = description
  if (ogImage) {
    meta.openGraph = {
      title,
      description,
      url: home,
      images: [{ url: ogImage }],
      type: "website",
    }
    meta.twitter = {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    }
  } else {
    meta.openGraph = { url: home, type: "website" }
  }
  return meta
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  // Parallelize independent fetches so the homepage TTFB stays tight.
  const [region, banners, settings, latestReviews] = await Promise.all([
    getRegion(countryCode),
    listBanners(),
    getSiteSettings(),
    getLatestReviews(8),
  ])

  if (!region) return null

  // Photos for the built-in hero (only needed while no admin banner exists).
  const heroProducts =
    banners.length > 0
      ? []
      : await listProducts({
          regionId: region.id,
          queryParams: { limit: 6, fields: "id,title,handle,thumbnail" } as any,
        })
          .then(({ response }) =>
            response.products.map((p) => ({
              id: p.id,
              title: p.title || "",
              handle: p.handle || "",
              thumbnail: p.thumbnail || null,
            }))
          )
          .catch(() => [])

  // Admin "Homepage Builder" sections — an ordered list of category rails
  // configured in /app/homepage and stored in site_settings as a JSON
  // string under `homepage_sections`. Malformed/empty → just the Latest
  // rail shows (back-compat).
  type HomeSection = {
    category_id: string
    category_name: string
    category_handle: string
    limit?: number
  }
  let homeSections: HomeSection[] = []
  try {
    const raw = (settings as any).homepage_sections
    if (raw && typeof raw === "string") {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        homeSections = parsed.filter(
          (s: any) => s && s.category_id && s.category_handle && s.category_name
        )
      }
    }
  } catch {
    /* malformed config → no category rails */
  }

  // Admin-curated top category bar (Homepage editor → "Top Category Bar").
  // mode "all" → all top-level; "custom" → chosen ids; "hidden" → no bar.
  const topCategoryBar = parseCategoryBar((settings as any).homepage_top_categories)

  const whatsappNumber = settings.whatsapp_number?.trim() || null
  // The hero owns the page's <h1>; the imported SEO article opens with
  // one too, so demote its headings a level.
  const homeArticle = (settings.page_home_content || "").replace(/<(\/?)h1\b/gi, "<$1h2")

  // Shopify-style flow: hero → categories → deals → promises → category
  // rails → reviews → wholesale → long-form copy (collapsed).
  return (
    <div className="container-anvogue pt-3 small:pt-5 pb-4">
      {banners.length > 0 ? (
        <HeroSlider banners={banners} />
      ) : (
        <BrandHero
          rating={{ average: latestReviews.average, count: latestReviews.count }}
          products={heroProducts}
        />
      )}

      <div id="shop-by-category" className="mt-6 small:mt-10 scroll-mt-28">
        <h2 className="section-title mb-3 small:mb-6 text-[22px] small:text-[32px]">Shop by category</h2>
        <CategoryCarouselServer
          selectedIds={topCategoryBar.ids}
          hidden={topCategoryBar.hidden}
        />
      </div>

      {/* Streams behind a skeleton so the shell above paints first. */}
      <div className="mt-5 small:mt-10">
        <Suspense fallback={<GridSkeleton count={10} />}>
          <ProductRail region={region} title="Weekly Discounts" limit={10} />
        </Suspense>
      </div>

      <BenefitsStrip />

      {/* Admin-configured category rails (Homepage Builder), in order.
          Each streams independently so a slow category query never
          blocks the rest of the page. */}
      {homeSections.map((s) => (
        <div key={s.category_id} className="mt-5 small:mt-8">
          <Suspense fallback={<GridSkeleton count={Math.min(10, s.limit || 10)} />}>
            <ProductRail
              region={region}
              category={{
                id: s.category_id,
                name: s.category_name,
                handle: s.category_handle,
              }}
              limit={s.limit || 10}
            />
          </Suspense>
        </div>
      ))}

      <CustomerReviews
        reviews={latestReviews.reviews}
        count={latestReviews.count}
        average={latestReviews.average}
      />

      <WholesaleBand whatsappNumber={whatsappNumber} />

      {homeArticle && (
        <section className="pt-5 small:pt-8 pb-2 mt-2 border-t border-line">
          <div className="max-w-4xl mx-auto">
            <ExpandableContent collapsedHeight={260} moreLabel="Read more about Khan Baba">
              <div
                className="prose prose-sm md:prose-base max-w-none text-ink/75 leading-relaxed prose-headings:text-ink prose-a:text-primary"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: homeArticle }}
              />
            </ExpandableContent>
          </div>
        </section>
      )}
    </div>
  )
}
