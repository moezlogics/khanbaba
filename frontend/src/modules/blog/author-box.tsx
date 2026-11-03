import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BlogAuthor } from "@lib/data/blog"

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

type Social = { href: string; icon: string; label: string }

function socialsOf(a: BlogAuthor): Social[] {
  const out: Social[] = []
  if (a.website_url) out.push({ href: a.website_url, icon: "ph-globe", label: "Website" })
  if (a.twitter_url) out.push({ href: a.twitter_url, icon: "ph-x-logo", label: "X" })
  if (a.linkedin_url) out.push({ href: a.linkedin_url, icon: "ph-linkedin-logo", label: "LinkedIn" })
  if (a.facebook_url) out.push({ href: a.facebook_url, icon: "ph-facebook-logo", label: "Facebook" })
  if (a.email) out.push({ href: `mailto:${a.email}`, icon: "ph-envelope-simple", label: "Email" })
  return out
}

function Avatar({
  author,
  size,
  className = "",
}: {
  author: BlogAuthor
  size: number
  className?: string
}) {
  if (author.avatar_url) {
    return (
      <Image
        src={author.avatar_url}
        alt={author.name}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`rounded-full flex-shrink-0 inline-flex items-center justify-center bg-brand-green text-brand-black font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials(author.name)}
    </span>
  )
}

/**
 * Compact byline shown under the post title: avatar + "By <name>" (links to
 * the author archive) + role, followed by the publish date and read time.
 */
export function AuthorByline({
  author,
  dateISO,
  dateLabel,
  readTime,
}: {
  author?: BlogAuthor | null
  dateISO: string
  dateLabel: string
  readTime: string
}) {
  return (
    <div className="flex items-center gap-3 caption1 text-brand-secondary mb-8 pb-8 border-b border-line">
      {author ? (
        <>
          <Avatar author={author} size={40} />
          <div className="min-w-0">
            <div className="text-brand-black font-medium leading-tight">
              By{" "}
              <LocalizedClientLink
                href={`/blog/author/${author.handle}`}
                className="hover:text-brand-secondary transition-colors"
              >
                {author.name}
              </LocalizedClientLink>
              {author.role ? (
                <span className="text-brand-secondary font-normal"> · {author.role}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <time dateTime={dateISO}>{dateLabel}</time>
              <span aria-hidden>·</span>
              <span>{readTime}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <time dateTime={dateISO}>{dateLabel}</time>
          <span aria-hidden>·</span>
          <span>{readTime}</span>
        </>
      )}
    </div>
  )
}

/**
 * Full E-E-A-T author card shown at the end of a post: avatar, name (links to
 * the author page), role/expertise, bio and social profiles.
 */
export function AuthorBox({ author }: { author: BlogAuthor }) {
  const socials = socialsOf(author)
  return (
    <aside
      className="mt-12 flex flex-col sm:flex-row gap-5 bg-surface border border-line rounded-2xl p-5 sm:p-6"
      aria-label={`About ${author.name}`}
    >
      <LocalizedClientLink
        href={`/blog/author/${author.handle}`}
        className="flex-shrink-0"
        aria-label={author.name}
      >
        <Avatar author={author} size={72} />
      </LocalizedClientLink>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <LocalizedClientLink
            href={`/blog/author/${author.handle}`}
            className="text-lg font-bold text-brand-black hover:text-brand-secondary transition-colors"
          >
            {author.name}
          </LocalizedClientLink>
          {author.role ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary2">
              {author.role}
            </span>
          ) : null}
        </div>
        {author.expertise ? (
          <p className="caption1 text-brand-secondary2 mt-0.5">{author.expertise}</p>
        ) : null}
        {author.bio ? (
          <p className="text-sm text-brand-secondary leading-relaxed mt-2">{author.bio}</p>
        ) : null}
        {socials.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {socials.map((s) => (
              <a
                key={s.icon}
                href={s.href}
                target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener nofollow"
                aria-label={`${author.name} on ${s.label}`}
                title={s.label}
                className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-brand-secondary hover:text-brand-secondary2 hover:border-brand-secondary2 transition-colors"
              >
                <i className={`ph ${s.icon} text-base`} aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
