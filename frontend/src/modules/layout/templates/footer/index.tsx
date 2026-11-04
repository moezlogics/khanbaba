import { getSiteSettings } from "@lib/data/site-settings"
import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Store footer in the Shopify layout: brand blurb + socials, then Shop
 * (categories), Help and Contact columns, then a copyright bar. On phones
 * the two link columns sit side by side and the rest stacks.
 *
 * Everything is admin-driven (Site Settings + categories); a blank setting
 * simply doesn't render. Colours come from the theme's footer tokens. The
 * brand name is set in type rather than the logo image, because the
 * dark-brown logo disappears on the black footer.
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
      .slice(0, 7)
      .map((c: any) => ({ href: `/${c.handle}`, label: c.name as string })),
    { href: "/store", label: "All products" },
  ]
  const helpLinks = [
    { href: "/about", label: "About us" },
    { href: "/contact", label: "Contact us" },
    { href: "/account/orders", label: "Track your order" },
    { href: "/refund-policy", label: "Refund policy" },
    { href: "/terms", label: "Terms & conditions" },
    { href: "/privacy", label: "Privacy policy" },
  ]

  const fg = { color: "rgb(var(--color-footer-fg))" }
  const heading = "mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-white"
  const link = "text-[14px] transition-colors hover:text-white"

  return (
    <footer
      className="relative mt-12 small:mt-20 pb-mobile-nav cv-section"
      style={{ backgroundColor: "rgb(var(--color-footer-bg))", ...fg }}
      role="contentinfo"
    >
      <div className="container-anvogue grid grid-cols-2 gap-x-6 gap-y-9 py-10 small:grid-cols-[1.4fr_1fr_1fr_1.2fr] small:gap-10 small:py-14">
        {/* Brand */}
        <div className="col-span-2 small:col-span-1">
          <p className="text-[22px] font-extrabold tracking-tight text-white">{siteName}</p>
          {tagline && <p className="mt-1 text-[13px] font-semibold text-white/80">{tagline}</p>}
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed">
            Premium dry fruits from Waziristan, Balochistan, Afghanistan and Iran — hand-picked,
            hygienically packed and delivered across Pakistan for over 40 years.
          </p>
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-white hover:text-white"
                >
                  <i className={`ph ${sx.icon} text-[17px]`} aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Shop */}
        <nav aria-label="Shop">
          <p className={heading}>Shop</p>
          <ul className="flex flex-col gap-2.5">
            {shopLinks.map((l) => (
              <li key={l.href}>
                <LocalizedClientLink href={l.href} className={link}>
                  {l.label}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Help */}
        <nav aria-label="Help">
          <p className={heading}>Help</p>
          <ul className="flex flex-col gap-2.5">
            {helpLinks.map((l) => (
              <li key={l.href}>
                <LocalizedClientLink href={l.href} className={link}>
                  {l.label}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        {(address || phone || email || waHref) && (
          <div className="col-span-2 small:col-span-1">
            <p className={heading}>Get in touch</p>
            <address className="not-italic flex flex-col gap-3 text-[14px]">
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className={`${link} inline-flex items-center gap-2.5`}>
                  <i className="ph ph-whatsapp-logo text-[18px] text-[#25D366]" aria-hidden />
                  WhatsApp us — 7 days a week
                </a>
              )}
              {telHref && (
                <a href={telHref} className={`${link} inline-flex items-center gap-2.5`}>
                  <i className="ph ph-phone text-[18px]" aria-hidden />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className={`${link} inline-flex items-center gap-2.5`}>
                  <i className="ph ph-envelope-simple text-[18px]" aria-hidden />
                  {email}
                </a>
              )}
              {address && (
                <span className="inline-flex items-start gap-2.5">
                  <i className="ph ph-map-pin mt-0.5 text-[18px]" aria-hidden />
                  {address}
                </span>
              )}
            </address>
          </div>
        )}
      </div>

      <div className="border-t" style={{ borderColor: "rgb(var(--color-footer-border))" }}>
        <div className="container-anvogue flex flex-col items-center justify-between gap-3 py-5 text-[12px] small:flex-row">
          <p>
            © {year} {siteName}. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <i className="ph ph-hand-coins text-[15px]" aria-hidden />
              Cash on Delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="ph ph-truck text-[15px]" aria-hidden />
              Nationwide delivery
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}
