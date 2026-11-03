import { canonicalUrl } from "@lib/util/seo-url"

/**
 * Social share row for a blog post — mirrors the PHP site's inline share
 * buttons (Facebook, WhatsApp, X, LinkedIn). Plain anchor links so it works
 * without JS and stays inside the static/ISR shell.
 */
export default function ShareButtons({
  handle,
  title,
  className = "",
}: {
  handle: string
  title: string
  className?: string
}) {
  const url = canonicalUrl(`/blog/${handle}`)
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)

  const items = [
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      icon: "ph-facebook-logo",
      label: "Facebook",
      bg: "#1877f2",
    },
    {
      href: `https://api.whatsapp.com/send?text=${t}%20-%20${u}`,
      icon: "ph-whatsapp-logo",
      label: "WhatsApp",
      bg: "#25d366",
    },
    {
      href: `https://x.com/intent/tweet?url=${u}&text=${t}`,
      icon: "ph-x-logo",
      label: "X",
      bg: "#0f172a",
    },
    {
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      icon: "ph-linkedin-logo",
      label: "LinkedIn",
      bg: "#0a66c2",
    },
  ]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="caption1 font-semibold text-brand-secondary2 mr-1">Share</span>
      {items.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener nofollow"
          aria-label={`Share on ${s.label}`}
          title={`Share on ${s.label}`}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white transition-transform hover:-translate-y-0.5"
          style={{ backgroundColor: s.bg }}
        >
          <i className={`ph ${s.icon} text-base`} aria-hidden />
        </a>
      ))}
    </div>
  )
}
