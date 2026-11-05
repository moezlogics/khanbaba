"""
Snapshot the Khan Baba WordPress/WooCommerce catalogue into catalog.json + images/.

Run once, locally, while khanbaba.pk still serves WordPress:

    python build_catalog.py <woocommerce-export.csv>

Why a snapshot instead of importing straight from WordPress: the moment the
domain points at the new storefront, every khanbaba.pk/wp-content/... image
URL and every wp-json endpoint disappears. Everything the import needs is
captured here, so `import-catalog.ts` can run on the server at any time.

Sources, and why each one:
  - the WooCommerce CSV export: prices, variations, weights, Yoast fields and
    the FAQ JSON-LD blocks (the public APIs strip <script> tags).
  - wc/store/v1/products: slugs (the CSV has none) and the rendered
    description HTML, which has paragraphs applied and no scripts.
  - wp/v2/product_cat: all categories including empty ones, with Yoast meta.
  - wc/store/v1/products/reviews: customer reviews.
  - the homepage: category icons (empty categories have no image elsewhere).
"""
import csv
import hashlib
import html
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "images")
SITE = "https://khanbaba.pk"
UA = {"User-Agent": "Mozilla/5.0 (KhanBaba catalogue snapshot)"}

# Homepage order of the category circles on the WordPress site.
CATEGORY_ORDER = [
    "chilgoza-price-in-pakistan", "badam", "pista-price-in-pakistan",
    "kaju-price-in-pakistan", "dried-apricot-price-in-pakistan",
    "anjeer-price-in-pakistan", "walnut-price-in-pakistan",
    "honey-price-in-pakistan", "peanuts-price-in-pakistan", "mix-dry-fruit",
    "dates-price-in-pakistan",
]
SKIP_CATEGORIES = {"uncategorized"}


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def get_json(path):
    return json.loads(get(SITE + path))


def download(url):
    """Save an image once under images/, named after its WordPress filename."""
    os.makedirs(IMG_DIR, exist_ok=True)
    name = os.path.basename(url.split("?")[0])
    path = os.path.join(IMG_DIR, name)
    if not os.path.exists(path):
        data = get(url, binary=True)
        with open(path, "wb") as f:
            f.write(data)
    return name


def full_size(url):
    """WordPress thumbnails end in -150x150.ext; the original drops that."""
    return re.sub(r"-\d+x\d+(\.\w+)$", r"\1", url)


def download_best(url):
    try:
        return download(full_size(url))
    except Exception:
        return download(url)


def grams(size):
    m = re.match(r"^\s*([\d.]+)\s*(kg|g)\s*$", size, re.I)
    if not m:
        return None
    n = float(m.group(1))
    return int(n * 1000) if m.group(2).lower() == "kg" else int(n)


def text_only(markup, limit=None):
    t = html.unescape(re.sub(r"<[^>]+>", " ", markup or ""))
    t = re.sub(r"\s+", " ", t).strip()
    if limit and len(t) > limit:
        t = t[: limit - 1].rsplit(" ", 1)[0] + "…"
    return t


def csv_text(s):
    """The WooCommerce exporter writes every line break of the original CRLF
    content as a real newline followed by a literal backslash-n."""
    return (s or "").replace("\r\n", "\n").replace("\n\\n", "\n").replace("\\n", "\n")


BLOCKS = (
    "table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|"
    "pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|fieldset|legend|"
    "section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary"
)


def wpautop(text):
    """Port of the parts of WordPress's wpautop() this content relies on: put
    loose text in <p>, turn single line breaks into <br />, and leave block
    elements alone. The public APIs return this already applied, but they
    also leak the text of stripped <script> tags, so it is redone here from
    the raw export."""
    text = text.strip()
    if not text:
        return ""
    text = re.sub(r"<(%s)([\s/>])" % BLOCKS, r"\n\n<\1\2", text)
    text = re.sub(r"(</(?:%s)>)" % BLOCKS, r"\1\n\n", text)
    out = []
    for chunk in re.split(r"\n\s*\n", text):
        chunk = chunk.strip()
        if not chunk:
            continue
        if re.match(r"</?(?:%s)[\s/>]" % BLOCKS, chunk):
            out.append(chunk)
        else:
            out.append("<p>" + chunk.replace("\n", "<br />\n") + "</p>")
    return "\n".join(out)


def clean_html(raw):
    """Raw export HTML -> display HTML: no scripts/styles, paragraphs applied,
    and the data-start/data-end attributes left by pasting from ChatGPT gone."""
    s = csv_text(raw)
    s = re.sub(r"<script\b.*?</script>", "", s, flags=re.S | re.I)
    s = re.sub(r"<style\b.*?</style>", "", s, flags=re.S | re.I)
    s = re.sub(r'\s+data-(?:start|end)="\d+"', "", s)
    return wpautop(s)


def yoast_vars(s):
    """Keep %%currentyear%% (the storefront fills it at render time so titles
    never go stale); resolve the separator; drop the rest."""
    if not s:
        return ""
    s = s.replace("%%sep%%", "–").replace("%%sitename%%", "Khan Baba")
    s = re.sub(r"%%(?!currentyear%%)[a-z_]+%%", "", s)
    return re.sub(r"\s+", " ", s).strip()


def page_html(markup):
    """WordPress page body -> plain semantic HTML: no layout wrappers,
    classes, inline styles, forms or scripts (the storefront styles it)."""
    s = re.sub(r"<(script|style|form|noscript)\b.*?</\1>", "", markup or "", flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"</?(div|span|section|figure)\b[^>]*>", "", s, flags=re.I)
    s = re.sub(r'\s+(class|style|id|data-[\w-]+|aria-[\w-]+)="[^"]*"', "", s)
    s = re.sub(r"<p>\s*(&nbsp;)?\s*</p>", "", s)
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def write_site_settings(pages):
    """Branding, contact details and page content for the site_settings
    module. import-catalog.ts only fills keys that are still empty, so
    anything changed in the admin afterwards is never overwritten."""
    brand_dir = os.path.join(IMG_DIR, "brand")
    os.makedirs(brand_dir, exist_ok=True)

    def brand_asset(url, name):
        path = os.path.join(brand_dir, name)
        if not os.path.exists(path):
            with open(path, "wb") as f:
                f.write(get(url, binary=True))
        return f"brand/{name}"

    def page(slug, key):
        pg = pages.get(slug) or {}
        if not pg:
            return {}
        return {f"page_{key}_title": pg["title"], f"page_{key}_content": page_html(pg.get("content_html", ""))}

    home = pages.get("khan-baba") or {}
    settings = {
        "site_name": "Khan Baba",
        "site_tagline": "Premium Dry Fruits Wholesaler in Pakistan",
        "seo_home_title": home.get("meta_title") or "Khan Baba Dry Fruit | Premium Dry Fruits Wholesaler in Pakistan",
        "seo_home_description": home.get("meta_description") or "",
        "seo_store_title": "Shop Dry Fruits Online in Pakistan",
        "page_home_content": home.get("seo_html") or "",
        # From the WordPress contact page.
        "contact_email": "order@khanbaba.pk",
        "contact_phone": "+92 303 0119992",
        "contact_address": "Head Office, Swat, Pakistan",
        "whatsapp_number": "923030119992",
        "whatsapp_widget_enabled": "true",
        "whatsapp_buy_now_enabled": "true",
        "social_facebook": "https://www.facebook.com/khanbabashop",
        "social_instagram": "https://www.instagram.com/khanbaba_pk",
        "footer_copyright": "Khanbaba.pk. All Rights Reserved.",
        # The store's three promises, scrolling in the brand colour.
        # Add-to-cart slides the cart in (Shopify behaviour).
        "cart_drawer_enabled": "true",
        "announcement_bar_enabled": "true",
        "announcement_bar_text": "Cash on Delivery all over Pakistan\n100% pure & fresh dry fruits — trusted for 40+ years",
        # No bar colours: it follows the theme's primary / on-primary.
        "business_type": "dryfruits",
        "business_country": "Pakistan",
        "business_locality": "Swat",
        "business_region": "Khyber Pakhtunkhwa",
        "business_opening_hours": "Mo-Su 00:00-23:59",
        "business_price_range": "Rs 800 - Rs 25,000",
        # Brand look: solid near-black text, deep terracotta actions,
        # maroon-brown footer, Josefin Sans body + Abril Fatface headings.
        "theme_primary": "#8E3B12",
        "theme_primary_fg": "#FFFFFF",
        "theme_accent": "#F3E3D3",
        "theme_accent_fg": "#4A1D06",
        "theme_text": "#111111",
        "theme_text_muted": "#3A3A3A",
        "theme_surface": "#FAF4EC",
        "theme_surface_alt": "#FDF9F4",
        "theme_border": "#E6D8C6",
        "theme_footer_bg": "#4A1A06",
        "theme_footer_fg": "#FFFFFF",
        "theme_footer_border": "#6E3517",
        "theme_font": "josefin",
        "theme_font_heading": "abril",
        # Every WordPress product photo is square.
        "product_card_aspect": "1/1",
        "theme_radius": "md",
        "theme_radius_card": "lg",
        "theme_radius_btn": "sm",
    }
    for slug, key in (("about-us", "about"), ("terms-conditions", "terms"),
                      ("privacy-policy", "privacy"), ("refund_returns", "refund")):
        settings.update(page(slug, key))

    site = {
        "settings": settings,
        # Uploaded to the CDN by the import; the resulting URL becomes the value.
        "assets": {
            "site_logo_url": brand_asset(SITE + "/wp-content/uploads/2025/11/khanbaba_logo.png", "khanbaba-logo.png"),
            "site_favicon_url": brand_asset(SITE + "/wp-content/uploads/2025/11/cropped-khan-dry-fruits-1-192x192.png", "khanbaba-icon-192.png"),
        },
    }
    with open(os.path.join(HERE, "site.json"), "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2)


def main(csv_path):
    csv.field_size_limit(10**9)
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
    parents = {r["ID"]: r for r in rows if r["Type"] == "variable"}
    variations = [r for r in rows if r["Type"] == "variation"]

    store_products = {str(p["id"]): p for p in get_json("/wp-json/wc/store/v1/products?per_page=100")}
    wp_cats = get_json("/wp-json/wp/v2/product_cat?per_page=100")
    store_cats = {c["slug"]: c for c in get_json("/wp-json/wc/store/v1/products/categories?per_page=100")}
    reviews_raw = get_json("/wp-json/wc/store/v1/products/reviews?per_page=100")
    # Yoast's rendered output — only used where the CSV field is empty
    # (Yoast falls back to a generated title there).
    wp_yoast = {str(p["id"]): p.get("yoast_head_json") or {}
                for p in get_json("/wp-json/wp/v2/product?per_page=100")}
    home = get(SITE + "/")

    # ---- categories -----------------------------------------------------
    icons = {}
    for m in re.finditer(r'<a[^>]+href="https?://khanbaba\.pk/collection/([^/"]+)/?"[^>]*>(.{0,1500}?)</a>', home, re.S):
        found = re.findall(r'(?:data-src|src)="([^"]+\.(?:png|jpe?g|webp))"', m.group(2))
        if found and m.group(1) not in icons:
            icons[m.group(1)] = found[0]

    by_wp_cat_name = {}
    categories = []
    for c in wp_cats:
        if c["slug"] in SKIP_CATEGORIES:
            continue
        y = c.get("yoast_head_json") or {}
        sc = store_cats.get(c["slug"], {})
        img_url = (sc.get("image") or {}).get("src") or icons.get(c["slug"])
        alt = (sc.get("image") or {}).get("alt") or c["name"]
        categories.append({
            "wp_id": c["id"],
            "handle": c["slug"],
            "name": html.unescape(c["name"]),
            "rank": CATEGORY_ORDER.index(c["slug"]) if c["slug"] in CATEGORY_ORDER else 99,
            "content_html": c.get("description") or "",
            "image": download_best(img_url) if img_url else None,
            "image_alt": alt,
            "meta_title": html.unescape(y.get("title") or ""),
            "meta_description": html.unescape(y.get("description") or ""),
        })
        by_wp_cat_name[html.unescape(c["name"])] = c["slug"]
    categories.sort(key=lambda c: (c["rank"], c["name"]))

    # ---- products -------------------------------------------------------
    product_cat = {}
    for pid, sp in store_products.items():
        product_cat[sp["slug"]] = (sp["categories"] or [{}])[0].get("slug")

    def rewrite_links(markup):
        """Point internal links at the new URL scheme, as site-relative paths."""
        def coll(m):
            return f'href="/collection/{m.group(1)}/"'

        def prod(m):
            slug = m.group(1)
            return f'href="/product/{slug}/"'

        markup = re.sub(r'href="https?://(?:www\.)?khanbaba\.pk/(?:collection|product-category)/([^/"]+)/?"', coll, markup)
        markup = re.sub(r'href="https?://(?:www\.)?khanbaba\.pk/product/([^/"]+)/?"', prod, markup)
        markup = re.sub(r'href="https?://(?:www\.)?khanbaba\.pk/?"', 'href="/"', markup)
        return markup

    products = []
    for pid, row in parents.items():
        sp = store_products.get(pid)
        if not sp:
            print(f"  ! WP product {pid} ({row['Name']}) missing from the store API — skipped")
            continue

        faq = None
        for block in re.findall(r"<script[^>]*>(.*?)</script>", csv_text(row["Description"]), re.S):
            try:
                data = json.loads(block)
            except ValueError:
                continue
            # Product schema blocks hard-code WordPress image URLs and old
            # prices; the storefront renders its own. Keep only the FAQs.
            if data.get("@type") == "FAQPage":
                faq = data

        images = []
        for im in sp.get("images") or []:
            images.append({"file": download(im["src"]), "alt": im.get("alt") or sp["name"]})

        kids = [v for v in variations if v["Parent"] == f"id:{pid}"]
        variants = []
        for v in kids:
            size = v["Attribute 1 value(s)"].strip()
            regular = float(v["Regular price"]) if v["Regular price"] else None
            sale = float(v["Sale price"]) if v["Sale price"] else None
            variants.append({
                "wp_id": int(v["ID"]),
                "size": size,
                "grams": grams(size),
                "regular_price": regular,
                "sale_price": sale if sale and regular and sale < regular else None,
                "in_stock": v["In stock?"] == "1",
            })
        variants.sort(key=lambda v: (v["grams"] is None, v["grams"] or 0, v["size"]))

        short_html = clean_html(row["Short description"])
        rich_html = clean_html(row["Description"])
        description = text_only(short_html, 300) or text_only(rich_html, 300)

        products.append({
            "wp_id": int(pid),
            "handle": sp["slug"],
            "title": html.unescape(sp["name"]),
            "description": description,
            "short_description_html": rewrite_links(short_html),
            "rich_description_html": rewrite_links(rich_html),
            "categories": [c["slug"] for c in sp["categories"]],
            "images": images,
            "meta_title": yoast_vars(row["Meta: _yoast_wpseo_title"])
            or html.unescape(wp_yoast.get(pid, {}).get("title") or ""),
            "meta_description": yoast_vars(row["Meta: _yoast_wpseo_metadesc"])
            or html.unescape(wp_yoast.get(pid, {}).get("description") or ""),
            "focus_keyword": row["Meta: _yoast_wpseo_focuskw"],
            "faq_schema": faq,
            "default_size": row["Attribute 1 default"] or (variants[0]["size"] if variants else None),
            "variants": variants,
        })
    products.sort(key=lambda p: p["wp_id"])

    # ---- reviews --------------------------------------------------------
    handle_by_id = {p["wp_id"]: p["handle"] for p in products}
    reviews = []
    for r in reviews_raw:
        handle = handle_by_id.get(r["product_id"])
        if not handle:
            continue
        reviews.append({
            "wp_id": r["id"],
            "product_handle": handle,
            "name": html.unescape(r["reviewer"]),
            "rating": r["rating"],
            "content": text_only(r["review"]),
            "verified": bool(r.get("verified")),
            "date": r["date_created_gmt"] + "Z",
        })

    # ---- redirects (WordPress URL -> new URL, one hop) -------------------
    redirects = []
    for c in categories:
        for prefix in ("collection", "product-category"):
            redirects.append({"source": f"/{prefix}/{c['handle']}", "destination": f"/{c['handle']}/"})
    for p in products:
        cat = p["categories"][0] if p["categories"] else None
        dest = f"/{cat}/{p['handle']}/" if cat else f"/{p['handle']}/"
        redirects.append({"source": f"/product/{p['handle']}", "destination": dest})

    # ---- content pages ----------------------------------------------------
    # Pages with real content become the storefront's static pages; the
    # WooCommerce shells (cart, checkout, account...) only need redirects.
    page_routes = {
        "about-us": "/about/", "contact-us": "/contact/", "terms-conditions": "/terms/",
        "privacy-policy": "/privacy/", "refund_returns": "/refund-policy/",
        "khan-baba": "/", "shop": "/store/", "cart": "/cart/", "checkout": "/checkout/",
        "my-account": "/account/", "order-tracking": "/account/orders/", "order-received": "/account/orders/",
        "ideas-for-breakfest": "/",
    }
    pages = {}
    for pg in get_json("/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,title,content,yoast_head_json"):
        slug = pg["slug"]
        body = (pg.get("content") or {}).get("rendered") or ""
        if len(text_only(body)) > 50:
            y = pg.get("yoast_head_json") or {}
            pages[slug] = {
                "title": html.unescape(pg["title"]["rendered"]),
                "route": page_routes.get(slug),
                "content_html": rewrite_links(re.sub(r'\s+data-(?:start|end)="\d+"', "", body)),
                "meta_title": html.unescape(y.get("title") or ""),
                "meta_description": html.unescape(y.get("description") or ""),
            }
        dest = page_routes.get(slug)
        if dest and dest != f"/{slug}/":
            redirects.append({"source": f"/{slug}", "destination": dest})
    # Fallbacks for anything added to WordPress after this snapshot: the
    # storefront resolves a product or category from the last path segment.
    for prefix in ("product-category", "collection", "product"):
        redirects.append({"source": f"/{prefix}/:slug", "destination": "/:slug/"})
    # The WordPress front page is an Elementor layout (~500 KB of product
    # carousels). Only its closing SEO article is content worth keeping:
    # take it from its first <h1>, drop the layout <div>s, and leave a single
    # <h1> so the new homepage keeps one.
    home = pages.get("khan-baba")
    if home:
        body = home.pop("content_html")
        start = body.find("<h1")
        article = body[start:] if start >= 0 else ""
        article = re.sub(r"</?div\b[^>]*>", "", article)
        article = re.sub(r"<!--.*?-->", "", article, flags=re.S)
        # Its Organization JSON-LD carries a placeholder phone number; the
        # storefront emits its own from the real site settings.
        article = re.sub(r"(<p>\s*)?<script\b.*?</script>(\s*</p>)?", "", article, flags=re.S)
        first = True

        def demote(m):
            nonlocal first
            if first:
                first = False
                return m.group(0)
            return m.group(0).replace("<h1", "<h2", 1).replace("</h1>", "</h2>")

        article = re.sub(r"<h1\b[^>]*>.*?</h1>", demote, article, flags=re.S)
        home["seo_html"] = re.sub(r"\n\s*\n+", "\n", article).strip()

    with open(os.path.join(HERE, "pages.json"), "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)

    write_site_settings(pages)

    catalog = {
        "source": SITE,
        "generated_from": os.path.basename(csv_path),
        "checksum": hashlib.sha256(open(csv_path, "rb").read()).hexdigest()[:16],
        "categories": categories,
        "products": products,
        "reviews": reviews,
        "redirects": redirects,
    }
    with open(os.path.join(HERE, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    # The storefront keeps the WordPress URL structure itself, so its
    # redirect list (frontend/wordpress-redirects.json) is maintained by
    # hand — it is not regenerated from here.

    n_var = sum(len(p["variants"]) for p in products)
    print(f"categories {len(categories)}, products {len(products)}, variants {n_var}, "
          f"reviews {len(reviews)}, redirects {len(redirects)}, images {len(os.listdir(IMG_DIR))}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python build_catalog.py <woocommerce-export.csv>")
    main(sys.argv[1])
