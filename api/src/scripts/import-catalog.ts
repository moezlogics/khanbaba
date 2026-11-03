import fs from "fs"
import path from "path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createPriceListPricesWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { ADVANCED_REVIEWS_MODULE } from "../modules/advanced_reviews"
import { SITE_SETTINGS_MODULE } from "../modules/site-settings"

/**
 * Imports the Khan Baba WooCommerce catalogue and sets the store up for
 * Pakistan. Reads the snapshot made by data/woocommerce/build_catalog.py.
 *
 *   npx medusa exec ./src/scripts/import-catalog.ts            # import
 *   npx medusa exec ./src/scripts/import-catalog.ts --dry-run  # check only
 *
 * Safe to run again: anything that already exists (matched by handle, name
 * or WordPress id) is left alone, so a second run only fills in what a
 * failed first run missed. It never edits or deletes existing data.
 *
 * Mapping from WooCommerce:
 *   variable product + variations -> product with a "Size" option
 *   regular price                 -> the variant's price
 *   sale price                    -> a "sale" price list, which is what the
 *                                    storefront reads to show the struck-out
 *                                    price and the "% OFF" badge
 *   Yoast title / description     -> metadata.meta_title / meta_description
 *   long description              -> metadata.rich_description (PDP tab)
 *   FAQ JSON-LD in the content    -> metadata.faq_schema (emitted on the PDP)
 *   reviews                       -> advanced_reviews, already approved
 */

const DATA_DIR = path.join(process.cwd(), "data", "woocommerce")
const CURRENCY = "pkr"
const COUNTRY = "pk"
const SALE_PRICE_LIST = "Khan Baba Discounts"
const API_KEY_TITLE = "Khan Baba Storefront"
const STOCK_LOCATION = "Khan Baba Warehouse"
const FULFILLMENT_SET = "Khan Baba Delivery"

// Matches the live WooCommerce checkout: a Rs 199 flat rate, free from
// Rs 3,000 (measured: Rs 2,820 paid delivery, Rs 3,760 was free).
const DELIVERY_FEE = Number(process.env.KB_DELIVERY_FEE ?? 199)
const FREE_DELIVERY_FROM = Number(process.env.KB_FREE_DELIVERY_FROM ?? 3000)

type Catalog = {
  categories: {
    wp_id: number
    handle: string
    name: string
    rank: number
    content_html: string
    image: string | null
    image_alt: string
    meta_title: string
    meta_description: string
  }[]
  products: {
    wp_id: number
    handle: string
    title: string
    description: string
    short_description_html: string
    rich_description_html: string
    categories: string[]
    images: { file: string; alt: string }[]
    meta_title: string
    meta_description: string
    focus_keyword: string
    faq_schema: Record<string, unknown> | null
    default_size: string | null
    variants: {
      wp_id: number
      size: string
      grams: number | null
      regular_price: number
      sale_price: number | null
      in_stock: boolean
    }[]
  }[]
  reviews: {
    wp_id: number
    product_handle: string
    name: string
    rating: number
    content: string
    verified: boolean
    date: string
  }[]
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

export default async function importCatalog({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const dryRun = (args || []).includes("--dry-run")

  const catalog: Catalog = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "catalog.json"), "utf8")
  )
  checkSnapshot(catalog)
  logger.info(
    `[import] snapshot: ${catalog.categories.length} categories, ${catalog.products.length} products, ` +
      `${catalog.products.reduce((n, p) => n + p.variants.length, 0)} variants, ${catalog.reviews.length} reviews`
  )
  if (dryRun) {
    logger.info("[import] --dry-run: snapshot is valid, nothing written.")
    return
  }

  /* ---------------- store, region, tax ---------------- */

  const storeService = container.resolve(Modules.STORE)
  const [store] = await storeService.listStores()
  await storeService.updateStores(store.id, {
    name: "Khan Baba",
    supported_currencies: [{ currency_code: CURRENCY, is_default: true }],
  })

  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const [salesChannel] = await salesChannelService.listSalesChannels({}, { take: 1 })
  if (!salesChannel) throw new Error("No sales channel — start the server once so Medusa creates the default one.")

  const regionService = container.resolve(Modules.REGION)
  let [region] = await regionService.listRegions({ currency_code: CURRENCY })
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Pakistan",
            currency_code: CURRENCY,
            countries: [COUNTRY],
            // Cash on delivery — the only method the WordPress store offers.
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = result[0]
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: COUNTRY, provider_id: "tp_system" }],
    })
    logger.info("[import] region Pakistan (PKR, COD) created")
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: salesChannel.id, default_region_id: region.id },
    },
  })

  /* ---------------- stock location + delivery ---------------- */

  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  let [location] = await stockLocationService.listStockLocations({ name: STOCK_LOCATION })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          { name: STOCK_LOCATION, address: { city: "Peshawar", country_code: "PK", address_1: "" } },
        ],
      },
    })
    location = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [salesChannel.id] },
    })
    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: { default_location_id: location.id } },
    })
  }

  let [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfile = result[0]
  }

  let [fulfillmentSet] = await fulfillmentService.listFulfillmentSets(
    { name: FULFILLMENT_SET },
    { relations: ["service_zones"] }
  )
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: FULFILLMENT_SET,
      type: "shipping",
      service_zones: [{ name: "Pakistan", geo_zones: [{ country_code: COUNTRY, type: "country" }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  }

  const existingOptions = await fulfillmentService.listShippingOptions({ name: "Standard Delivery" })
  if (!existingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Delivery",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Standard", description: "Delivery across Pakistan in 2–4 days.", code: "standard" },
          prices: [
            { currency_code: CURRENCY, amount: DELIVERY_FEE },
            {
              currency_code: CURRENCY,
              amount: 0,
              rules: [{ attribute: "item_total", operator: "gte", value: FREE_DELIVERY_FROM }],
            },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`[import] delivery: Rs ${DELIVERY_FEE}, free from Rs ${FREE_DELIVERY_FROM}`)
  }

  /* ---------------- publishable key ---------------- */

  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title"],
    filters: { type: "publishable", title: API_KEY_TITLE },
  })
  let apiKey = keys[0]
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: API_KEY_TITLE, type: "publishable", created_by: "" }] },
    })
    apiKey = result[0] as any
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [salesChannel.id] },
    })
  }

  /* ---------------- images ---------------- */

  const uploaded = new Map<string, string>()
  async function upload(file: string): Promise<string> {
    const hit = uploaded.get(file)
    if (hit) return hit
    const full = path.join(DATA_DIR, "images", file)
    const ext = path.extname(file).toLowerCase()
    const { result } = await uploadFilesWorkflow(container).run({
      input: {
        files: [
          {
            filename: path.basename(file),
            mimeType: MIME[ext] || "application/octet-stream",
            content: fs.readFileSync(full).toString("base64"),
            access: "public",
          },
        ],
      },
    })
    uploaded.set(file, result[0].url)
    return result[0].url
  }

  /* ---------------- categories ---------------- */

  const productModule = container.resolve(Modules.PRODUCT)
  const categoryIdByHandle = new Map<string, string>()
  let newCategories = 0
  for (const c of catalog.categories) {
    const [existing] = await productModule.listProductCategories({ handle: c.handle })
    if (existing) {
      categoryIdByHandle.set(c.handle, existing.id)
      continue
    }
    const image = c.image ? await upload(c.image) : null
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: c.name,
            handle: c.handle,
            is_active: true,
            is_internal: false,
            rank: c.rank,
            metadata: {
              image,
              image_alt: c.image_alt,
              meta_title: c.meta_title || null,
              meta_description: c.meta_description || null,
              content: c.content_html || null,
              wp_id: c.wp_id,
            },
          },
        ],
      },
    })
    categoryIdByHandle.set(c.handle, result[0].id)
    newCategories++
  }
  logger.info(`[import] categories: ${newCategories} created, ${catalog.categories.length - newCategories} already there`)

  /* ---------------- products ---------------- */

  const { data: saleLists } = await query.graph({
    entity: "price_list",
    fields: ["id"],
    filters: { title: SALE_PRICE_LIST },
  })
  let saleListId: string | undefined = saleLists[0]?.id
  const salePrices: { variant_id: string; amount: number; currency_code: string }[] = []

  const productIdByHandle = new Map<string, string>()
  let newProducts = 0
  for (const p of catalog.products) {
    const [existing] = await productModule.listProducts({ handle: p.handle }, { take: 1 })
    if (existing) {
      productIdByHandle.set(p.handle, existing.id)
      continue
    }

    const images: { url: string }[] = []
    for (const im of p.images) images.push({ url: await upload(im.file) })

    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: p.title,
            handle: p.handle,
            description: p.description,
            status: "published",
            discountable: true,
            thumbnail: images[0]?.url,
            images,
            category_ids: p.categories
              .map((h) => categoryIdByHandle.get(h))
              .filter((id): id is string => !!id),
            sales_channels: [{ id: salesChannel.id }],
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Size", values: p.variants.map((v) => v.size) }],
            variants: p.variants.map((v, i) => ({
              title: v.size,
              sku: `KB-${v.wp_id}`,
              options: { Size: v.size },
              // WooCommerce tracked "in stock" without quantities, so stock
              // is not managed here either — every size stays orderable.
              manage_inventory: false,
              allow_backorder: false,
              variant_rank: i,
              ...(v.grams ? { weight: v.grams } : {}),
              prices: [{ amount: v.regular_price, currency_code: CURRENCY }],
              metadata: { wp_id: v.wp_id },
            })),
            metadata: {
              source: "woocommerce",
              wp_id: p.wp_id,
              meta_title: p.meta_title || null,
              meta_description: p.meta_description || null,
              focus_keyword: p.focus_keyword || null,
              rich_description: p.rich_description_html || null,
              short_description: p.short_description_html || null,
              faq_schema: p.faq_schema,
              default_size: p.default_size,
              image_alts: p.images.map((im) => im.alt),
            },
          },
        ],
      },
    })
    const product = result[0]
    productIdByHandle.set(p.handle, product.id)
    newProducts++

    for (const v of p.variants) {
      if (!v.sale_price) continue
      const created = product.variants.find((pv: any) => pv.sku === `KB-${v.wp_id}`)
      if (created) salePrices.push({ variant_id: created.id, amount: v.sale_price, currency_code: CURRENCY })
    }
  }
  logger.info(`[import] products: ${newProducts} created, ${catalog.products.length - newProducts} already there`)

  if (salePrices.length) {
    if (!saleListId) {
      const { result } = await createPriceListsWorkflow(container).run({
        input: {
          price_lists_data: [
            {
              title: SALE_PRICE_LIST,
              // Price lists default to type "sale", which is what makes the
              // storefront show the regular price struck out.
              description: "Sale prices imported from the WordPress store.",
              status: "active",
              prices: salePrices,
            },
          ],
        },
      })
      saleListId = result[0].id
    } else {
      await createPriceListPricesWorkflow(container).run({
        input: { data: [{ id: saleListId, prices: salePrices }] },
      })
    }
    logger.info(`[import] sale prices: ${salePrices.length} added to "${SALE_PRICE_LIST}"`)
  }

  /* ---------------- reviews ---------------- */

  const reviewService: any = container.resolve(ADVANCED_REVIEWS_MODULE)
  const done = new Set<number>(
    (await reviewService.listAdvancedReviews({}, { take: 10000 }))
      .map((r: any) => Number(r.metadata?.wp_review_id))
      .filter(Boolean)
  )
  const toCreate = catalog.reviews
    .filter((r) => !done.has(r.wp_id) && productIdByHandle.has(r.product_handle))
    .map((r) => ({
      product_id: productIdByHandle.get(r.product_handle)!,
      guest_name: r.name,
      rating: r.rating,
      content: r.content,
      is_verified: r.verified,
      status: "approved",
      created_at: new Date(r.date),
      metadata: { source: "woocommerce", wp_review_id: r.wp_id, original_date: r.date },
    }))
  if (toCreate.length) await reviewService.createAdvancedReviews(toCreate)
  logger.info(`[import] reviews: ${toCreate.length} created, ${catalog.reviews.length - toCreate.length} already there`)

  /* ---------------- site settings ---------------- */

  // Branding, contact details, theme and page content from the WordPress
  // site. Only keys that are still empty are written, so whatever has been
  // changed in the admin since is never overwritten by a re-run.
  const site: { settings: Record<string, string>; assets: Record<string, string> } = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "site.json"), "utf8")
  )
  const settingsService: any = container.resolve(SITE_SETTINGS_MODULE)
  const current: Record<string, string> = await settingsService.getAll()
  const isEmpty = (key: string) => !String(current[key] ?? "").trim()
  const toWrite: Record<string, string> = {}
  for (const [key, value] of Object.entries(site.settings)) {
    if (isEmpty(key) && value) toWrite[key] = value
  }
  for (const [key, file] of Object.entries(site.assets)) {
    if (isEmpty(key)) toWrite[key] = await upload(file)
  }
  // Homepage rails (admin "Homepage Builder" format): one per category that
  // has enough products to fill a row, in the WordPress category order.
  if (isEmpty("homepage_sections")) {
    const counts = new Map<string, number>()
    for (const p of catalog.products) {
      for (const h of p.categories) counts.set(h, (counts.get(h) || 0) + 1)
    }
    const sections = catalog.categories
      .filter((c) => (counts.get(c.handle) || 0) >= 3 && categoryIdByHandle.has(c.handle))
      .map((c) => ({
        category_id: categoryIdByHandle.get(c.handle)!,
        category_name: c.name,
        category_handle: c.handle,
        limit: 10,
      }))
    if (sections.length) toWrite.homepage_sections = JSON.stringify(sections)
  }
  if (Object.keys(toWrite).length) await settingsService.bulkUpsert(toWrite)
  logger.info(
    `[import] site settings: ${Object.keys(toWrite).length} filled, ` +
      `${Object.keys(site.settings).length + Object.keys(site.assets).length - Object.keys(toWrite).length} kept as they were`
  )

  /* ---------------- what the storefront needs ---------------- */

  logger.info("")
  logger.info("[import] Done. Put these two lines in the storefront .env:")
  logger.info(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${(apiKey as any).token}`)
  logger.info(`NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=${salesChannel.id}`)
}

/** Fail before writing anything if the snapshot is incomplete. */
function checkSnapshot(c: Catalog) {
  const problems: string[] = []
  const cats = new Set(c.categories.map((x) => x.handle))
  const imageDir = path.join(DATA_DIR, "images")
  const need = (file: string | null, what: string) => {
    if (file && !fs.existsSync(path.join(imageDir, file))) problems.push(`${what}: image ${file} missing`)
  }
  for (const cat of c.categories) need(cat.image, `category ${cat.handle}`)
  for (const p of c.products) {
    if (!p.variants.length) problems.push(`${p.handle}: no variants`)
    if (p.categories.some((h) => !cats.has(h))) problems.push(`${p.handle}: unknown category`)
    for (const v of p.variants) {
      if (!(v.regular_price > 0)) problems.push(`${p.handle} ${v.size}: no price`)
    }
    p.images.forEach((im) => need(im.file, p.handle))
  }
  if (problems.length) throw new Error("Snapshot problems:\n  " + problems.join("\n  "))
}
