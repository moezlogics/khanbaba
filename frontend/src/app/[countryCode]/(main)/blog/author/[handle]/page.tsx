import { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { getBlogAuthorByHandle } from "@lib/data/blog"
import { getSiteSettings } from "@lib/data/site-settings"
import { canonicalUrl, ROBOTS_INDEX } from "@lib/util/seo-url"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Author archive pages are anonymous + identical for every visitor → ISR.
export const revalidate = 300

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const data = await getBlogAuthorByHandle(params.handle)
  if (!data) return { title: "Author Not Found" }

  const { author } = data
  const title = `${author.name}${author.role ? ` — ${author.role}` : ""}`
  const description =
    author.bio ||
    `Articles, reviews and buying guides by ${author.name}.`
  const url = canonicalUrl(`/blog/author/${author.handle}`)

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: ROBOTS_INDEX,
    openGraph: {
      title,
      description,
      type: "profile",
      url,
      ...(author.avatar_url
        ? { images: [{ url: author.avatar_url, alt: author.name }] }
        : {}),
    },
  }
}

export default async function AuthorPage(props: Props) {
  const params = await props.params
  const [data, settings] = await Promise.all([
    getBlogAuthorByHandle(params.handle),
    getSiteSettings(),
  ])

  if (!data) notFound()

  const { author, posts } = data
  const siteName = settings.site_name || "Blog"

  const socials = [
    author.website_url && { href: author.website_url, icon: "ph-globe", label: "Website" },
    author.twitter_url && { href: author.twitter_url, icon: "ph-x-logo", label: "X" },
    author.linkedin_url && { href: author.linkedin_url, icon: "ph-linkedin-logo", label: "LinkedIn" },
    author.facebook_url && { href: author.facebook_url, icon: "ph-facebook-logo", label: "Facebook" },
    author.email && { href: `mailto:${author.email}`, icon: "ph-envelope-simple", label: "Email" },
  ].filter(Boolean) as { href: string; icon: string; label: string }[]

  const sameAs = [
    author.website_url,
    author.twitter_url,
    author.linkedin_url,
    author.facebook_url,
  ].filter(Boolean)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: author.name,
      url: canonicalUrl(`/blog/author/${author.handle}`),
      ...(author.role ? { jobTitle: author.role } : {}),
      ...(author.bio ? { description: author.bio } : {}),
      ...(author.avatar_url ? { image: author.avatar_url } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      worksFor: { "@type": "Organization", name: siteName },
    },
  }

  return (
    <div className="container-anvogue py-10 md:py-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 caption1 text-brand-secondary2" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li>
            <LocalizedClientLink href="/" className="hover:text-brand-black transition-colors">
              Home
            </LocalizedClientLink>
          </li>
          <li aria-hidden>/</li>
          <li>
            <LocalizedClientLink href="/blog" className="hover:text-brand-black transition-colors">
              Blog
            </LocalizedClientLink>
          </li>
          <li aria-hidden>/</li>
          <li className="text-brand-secondary">{author.name}</li>
        </ol>
      </nav>

      {/* Author hero */}
      <header className="flex flex-col sm:flex-row gap-6 items-start bg-surface border border-line rounded-2xl p-6 md:p-8 mb-10">
        {author.avatar_url ? (
          <Image
            src={author.avatar_url}
            alt={author.name}
            width={104}
            height={104}
            className="rounded-full object-cover flex-shrink-0"
            style={{ width: 104, height: 104 }}
            priority
          />
        ) : (
          <span
            className="rounded-full flex-shrink-0 inline-flex items-center justify-center bg-brand-green text-brand-black font-bold"
            style={{ width: 104, height: 104, fontSize: 40 }}
            aria-hidden
          >
            {initials(author.name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="heading2 text-brand-black">{author.name}</h1>
          {author.role ? (
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-secondary2 mt-1">
              {author.role}
            </p>
          ) : null}
          {author.expertise ? (
            <p className="caption1 text-brand-secondary2 mt-1">{author.expertise}</p>
          ) : null}
          {author.bio ? (
            <p className="body1 text-brand-secondary leading-relaxed mt-3 max-w-2xl">
              {author.bio}
            </p>
          ) : null}
          {socials.length > 0 && (
            <div className="flex items-center gap-2 mt-4">
              {socials.map((s) => (
                <a
                  key={s.icon}
                  href={s.href}
                  target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener nofollow"
                  aria-label={`${author.name} on ${s.label}`}
                  title={s.label}
                  className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-brand-secondary hover:text-brand-secondary2 hover:border-brand-secondary2 transition-colors"
                >
                  <i className={`ph ${s.icon} text-base`} aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Posts by this author */}
      <h2 className="heading3 text-brand-black mb-6">
        {posts.length > 0
          ? `Articles by ${author.name}`
          : `No articles by ${author.name} yet`}
      </h2>

      {posts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {posts.map((p) => (
            <LocalizedClientLink
              key={p.id}
              href={`/blog/${p.handle}`}
              className="group flex flex-col"
            >
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-surface mb-3">
                {p.featured_image ? (
                  <Image
                    src={p.featured_image}
                    alt={p.featured_image_alt || p.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : null}
              </div>
              {p.categories?.length > 0 && (
                <span className="text-button-uppercase text-brand-secondary2 mb-1">
                  {p.categories[0].name}
                </span>
              )}
              <h3 className="text-base font-semibold text-brand-black leading-snug group-hover:text-brand-secondary transition-colors line-clamp-2">
                {p.title}
              </h3>
              <time
                dateTime={p.published_at || p.created_at}
                className="caption1 text-brand-secondary2 mt-1.5"
              >
                {formatDate(p.published_at || p.created_at)}
              </time>
            </LocalizedClientLink>
          ))}
        </div>
      )}
    </div>
  )
}
