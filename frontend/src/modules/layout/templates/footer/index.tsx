import { getSiteSettings } from "@lib/data/site-settings"
import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Minimal store footer: brand line + socials, two link columns and a
 * contact column, then a thin copyright bar.
 *
 * Colours come ONLY from the theme's footer tokens (Appearance → Footer
 * background / text / border), so it reads correctly on a dark or light
 * footer: headings use the footer text colour at full strength, links at
 * 88%. Every piece is admin-driven and hides itself when blank.
 */
export default async function Footer() {
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    listCategories({ limit: 50, order: "rank" }).catch(() => []),
  ])

  const siteName = settings.site_name?.trim() || "Store"
  const tagline = settings.site_tagline?.trim()
  const year = new Date().getFullYear()

  const address = settings.contact_address?.trim()
  const phone = settings.contact_phone?.trim()
  const email = settings.contact_email?.trim()
  const whatsapp = settings.whatsapp_number?.trim()
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null

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

  const shopLinks = [
    ...(categories || [])
      .filter((c: any) => !c.parent_category_id)
      .slice(0, 5)
      .map((c: any) => ({ href: `/collection/${c.handle}`, label: c.name as string })),
    { href: "/shop", label: "All products" },
  ]
  const helpLinks = [
    { href: "/about-us", label: "About us" },
    { href: "/contact-us", label: "Contact" },
    { href: "/my-account/orders", label: "Track order" },
    { href: "/refund_returns", label: "Refund policy" },
    { href: "/terms-conditions", label: "Terms" },
    { href: "/privacy-policy", label: "Privacy" },
  ]

  // Footer tokens as utility values (no Tailwind alias exists for them).
  const fgStrong = "text-[rgb(var(--color-footer-fg))]"
  const fgSoft = "text-[rgb(var(--color-footer-fg)/0.88)]"
  const heading = `label-caps mb-4 text-[15px] ${fgStrong}`
  const link = `text-[15px] ${fgSoft} transition-colors hover:text-[rgb(var(--color-footer-fg))] hover:underline underline-offset-4`

  return (
    <footer
      className="relative mt-8 small:mt-16 pb-mobile-nav cv-section bg-[rgb(var(--color-footer-bg))]"
      role="contentinfo"
    >
      <div className="container-anvogue grid grid-cols-2 gap-x-6 gap-y-7 py-8 small:grid-cols-[1.5fr_1fr_1fr_1.3fr] small:gap-12 small:py-14">
        <div className="col-span-2 small:col-span-1">
          <p className={`text-[28px] font-heading ${fgStrong}`}>{siteName}</p>
          {tagline && <p className={`mt-2 max-w-xs text-[15px] leading-relaxed ${fgSoft}`}>{tagline}</p>}
          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map((sx) => (
                <a
                  key={sx.label}
                  href={sx.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={sx.label}
                  title={sx.label}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgb(var(--color-footer-border))] ${fgSoft} transition-colors hover:text-[rgb(var(--color-footer-fg))] hover:border-[rgb(var(--color-footer-fg)/0.5)]`}
                >
                  <i className={`ph ${sx.icon} text-[18px]`} aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>

        <nav aria-label="Shop">
          <p className={heading}>Shop</p>
          <ul className="flex flex-col gap-3">
            {shopLinks.map((l) => (
              <li key={l.href}>
                <LocalizedClientLink href={l.href} className={link}>
                  {l.label}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Help">
          <p className={heading}>Help</p>
          <ul className="flex flex-col gap-3">
            {helpLinks.map((l) => (
              <li key={l.href}>
                <LocalizedClientLink href={l.href} className={link}>
                  {l.label}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>

        {(address || phone || email) && (
          <div className="col-span-2 small:col-span-1">
            <p className={heading}>Contact</p>
            <address className="not-italic flex flex-col gap-3">
              {telHref && (
                <a href={telHref} className={`${link} inline-flex items-center gap-2.5`}>
                  <i className="ph ph-phone text-[18px]" aria-hidden />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className={`${link} inline-flex items-center gap-2.5 break-all`}>
                  <i className="ph ph-envelope-simple text-[18px]" aria-hidden />
                  {email}
                </a>
              )}
              {address && (
                <span className={`inline-flex items-start gap-2.5 text-[15px] ${fgSoft}`}>
                  <i className="ph ph-map-pin mt-0.5 text-[18px]" aria-hidden />
                  {address}
                </span>
              )}
            </address>
          </div>
        )}
      </div>

      <div className="border-t border-[rgb(var(--color-footer-border))]">
        <div className={`container-anvogue flex flex-col items-center justify-between gap-2 py-4 small:py-6 text-[13px] small:flex-row ${fgSoft}`}>
          <p>
            © {year} {siteName}. All rights reserved.
          </p>
          <p>Cash on Delivery · Nationwide delivery</p>
        </div>
      </div>
    </footer>
  )
}
