import { getSiteSettings } from "@lib/data/site-settings"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Ultra-minimal footer — just a hairline, a single row of links, and
 * a whisper-quiet copyright. No perks strip, no accordion columns, no
 * heavy chrome. The idea is that the footer signals "end of page"
 * without competing with the product grid above it.
 *
 * Desktop & mobile share the same single-row layout; the links just
 * wrap naturally on narrow screens.
 */
export default async function Footer() {
  const settings = await getSiteSettings()

  const siteName = settings.site_name?.trim() || "Store"
  const year = new Date().getFullYear()

  // Everything below is admin-driven and each piece is independently
  // optional: a setting left blank simply doesn't render, so the footer
  // stays minimal instead of showing empty labels or dead icons.
  const address = settings.contact_address?.trim()
  const phone = settings.contact_phone?.trim()
  const email = settings.contact_email?.trim()
  const whatsapp = settings.whatsapp_number?.trim()

  // `tel:` / `wa.me` need the bare digits; the displayed text keeps
  // whatever formatting the admin typed.
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null
  const waHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}`
    : null

  const socials = [
    { href: settings.social_facebook, icon: "ph-facebook-logo", label: "Facebook" },
    { href: settings.social_instagram, icon: "ph-instagram-logo", label: "Instagram" },
    { href: settings.social_twitter, icon: "ph-x-logo", label: "X" },
    { href: settings.social_youtube, icon: "ph-youtube-logo", label: "YouTube" },
    { href: settings.social_tiktok, icon: "ph-tiktok-logo", label: "TikTok" },
    { href: settings.social_pinterest, icon: "ph-pinterest-logo", label: "Pinterest" },
    ...(waHref ? [{ href: waHref, icon: "ph-whatsapp-logo", label: "WhatsApp" }] : []),
  ].filter((sx): sx is { href: string; icon: string; label: string } =>
    typeof sx.href === "string" && sx.href.trim().length > 0
  )

  const hasContact = !!(address || phone || email)

  const links = [
    { href: "/store", label: "Shop" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/refund-policy", label: "Refunds" },
  ]

  return (
    <footer
      className="relative mt-12 md:mt-20 pb-mobile-nav cv-section"
      style={{ backgroundColor: "rgb(var(--color-footer-bg))" }}
      role="contentinfo"
    >
      {/* Hairline — fades in from the edges so it feels lighter than
          a solid 1px border. */}
      <div
        className="h-px"
        style={{
          background: "linear-gradient(to right, transparent, rgb(var(--color-footer-border)), transparent)",
        }}
      />

      <div className="container-anvogue py-8 md:py-10 flex flex-col items-center gap-5">
        {/* Single link row — tiny, airy, centred. */}
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {links.map((l) => (
            <LocalizedClientLink
              key={l.href}
              href={l.href}
              className="text-[11px] transition-colors duration-200 hover:opacity-80"
              style={{ color: "rgb(var(--color-footer-fg))" }}
            >
              {l.label}
            </LocalizedClientLink>
          ))}
        </nav>

        {/* Contact line — address / phone / email share one wrapped row so
            it reads as a single quiet line rather than three stacked
            blocks. Phone and email are tappable; the address is plain
            text since it has nowhere useful to link to. */}
        {hasContact && (
          <address
            className="not-italic flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 text-[11px]"
            style={{ color: "rgb(var(--color-footer-fg))", opacity: 0.8 }}
          >
            {address && (
              <span className="inline-flex items-center gap-1.5 text-center">
                <i className="ph ph-map-pin text-[13px] shrink-0" aria-hidden />
                {address}
              </span>
            )}
            {telHref && (
              <a href={telHref} className="inline-flex items-center gap-1.5 hover:opacity-100 transition-opacity">
                <i className="ph ph-phone text-[13px] shrink-0" aria-hidden />
                {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:opacity-100 transition-opacity">
                <i className="ph ph-envelope-simple text-[13px] shrink-0" aria-hidden />
                {email}
              </a>
            )}
          </address>
        )}

        {/* Social icons — icon-only to keep the row short. */}
        {socials.length > 0 && (
          <div className="flex flex-wrap justify-center items-center gap-3">
            {socials.map((sx) => (
              <a
                key={sx.label}
                href={sx.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={sx.label}
                title={sx.label}
                className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100"
                style={{ color: "rgb(var(--color-footer-fg))", opacity: 0.75 }}
              >
                <i className={`ph ${sx.icon} text-[15px]`} aria-hidden />
              </a>
            ))}
          </div>
        )}

        {/* Copyright — smaller than the links, almost a watermark. */}
        <p
          className="text-[10px] tracking-wide"
          style={{ color: "rgb(var(--color-footer-fg))", opacity: 0.65 }}
        >
          © {year} {siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
