import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { SITE_SETTINGS_MODULE } from "../modules/site-settings"

/**
 * Rewrites internal links inside imported content to the WordPress URL
 * structure the storefront now uses:
 *
 *   href="/<category>/"            -> href="/collection/<category>/"
 *   href="/<category>/<product>/"  -> href="/product/<product>/"
 *   href="/<product>/"             -> href="/product/<product>/"
 *
 * Covers product rich/short descriptions, category content and the page
 * content in Site Settings. Only links that point at a real product or
 * category handle are touched; everything else is left as it is.
 *
 *   npx medusa exec ./src/scripts/fix-content-links.ts            # apply
 *   npx medusa exec ./src/scripts/fix-content-links.ts --dry-run  # report only
 *
 * Safe to run more than once — already-correct links don't match.
 */
export default async function fixContentLinks({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dryRun = (args || []).includes("--dry-run")
  const productModule = container.resolve(Modules.PRODUCT)

  const products = await productModule.listProducts({}, { select: ["id", "handle", "metadata"], take: 5000 })
  const categories = await productModule.listProductCategories(
    {},
    { select: ["id", "handle", "metadata"], take: 5000 }
  )
  const productHandles = new Set(products.map((p) => p.handle))
  const categoryHandles = new Set(categories.map((c) => c.handle))

  const fix = (html: unknown): string | null => {
    if (typeof html !== "string" || !html.includes("href=")) return null
    const out = html.replace(/href="(\/[^"#?]*)"/g, (whole, path: string) => {
      const parts = path.split("/").filter(Boolean)
      if (parts.length === 2 && categoryHandles.has(parts[0]) && productHandles.has(parts[1])) {
        return `href="/product/${parts[1]}/"`
      }
      if (parts.length === 1 && productHandles.has(parts[0])) return `href="/product/${parts[0]}/"`
      if (parts.length === 1 && categoryHandles.has(parts[0])) return `href="/collection/${parts[0]}/"`
      return whole
    })
    return out === html ? null : out
  }

  let productCount = 0
  for (const p of products) {
    const meta = { ...((p.metadata as Record<string, unknown>) || {}) }
    let changed = false
    for (const key of ["rich_description", "short_description", "rich_description_en", "rich_description_ur"]) {
      const next = fix(meta[key])
      if (next !== null) {
        meta[key] = next
        changed = true
      }
    }
    if (!changed) continue
    productCount++
    if (!dryRun) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: p.id }, update: { metadata: meta } },
      })
    }
  }

  let categoryCount = 0
  for (const c of categories) {
    const meta = { ...((c.metadata as Record<string, unknown>) || {}) }
    const next = fix(meta.content)
    if (next === null) continue
    meta.content = next
    categoryCount++
    if (!dryRun) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: c.id }, update: { metadata: meta } },
      })
    }
  }

  const settingsService: any = container.resolve(SITE_SETTINGS_MODULE)
  const settings: Record<string, string> = await settingsService.getAll()
  const settingUpdates: Record<string, string> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith("page_")) continue
    const next = fix(value)
    if (next !== null) settingUpdates[key] = next
  }
  if (!dryRun && Object.keys(settingUpdates).length) await settingsService.bulkUpsert(settingUpdates)

  logger.info(
    `[fix-content-links] ${dryRun ? "(dry run) would update" : "updated"}: ` +
      `${productCount} products, ${categoryCount} categories, ` +
      `${Object.keys(settingUpdates).length} page settings`
  )
}
