import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { installDraftKeeper } from "../lib/draft-keeper"

/**
 * Turns on the Draft Keeper (see `lib/draft-keeper.ts`) on the built-in
 * Medusa pages — most importantly the product create form, which is a
 * child route of the product list, so this widget stays mounted while it
 * is open.
 *
 * Renders nothing. The keeper itself is plain DOM attached to the
 * document, so one mount covers every later route change; the long zone
 * list is only about which page a hard reload can land on.
 */
const DraftKeeperWidget = () => {
  // The module installs itself on import; this is only here so the import
  // can never be dropped as unused, and is a no-op the second time.
  useEffect(() => {
    installDraftKeeper()
  }, [])
  return null
}

export const config = defineWidgetConfig({
  zone: [
    "product.list.before",
    "product.details.before",
    "product_category.list.before",
    "product_category.details.before",
    "product_collection.list.before",
    "product_collection.details.before",
    "product_tag.list.before",
    "product_type.list.before",
    "product_variant.details.before",
    "inventory_item.list.before",
    "inventory_item.details.before",
    "order.list.before",
    "order.details.before",
    "customer.list.before",
    "customer.details.before",
    "customer_group.list.before",
    "customer_group.details.before",
    "promotion.list.before",
    "promotion.details.before",
    "campaign.list.before",
    "campaign.details.before",
    "price_list.list.before",
    "price_list.details.before",
    "user.list.before",
    "user.details.before",
    "profile.details.before",
    "store.details.before",
    "region.list.before",
    "region.details.before",
    "location.list.before",
    "location.details.before",
    "sales_channel.list.before",
    "sales_channel.details.before",
    "shipping_profile.list.before",
    "shipping_profile.details.before",
    "tax.list.before",
    "tax.details.before",
    "api_key.list.before",
    "api_key.details.before",
    "reservation.list.before",
    "reservation.details.before",
    "return_reason.list.before",
    "refund_reason.list.before",
  ],
})

export default DraftKeeperWidget
