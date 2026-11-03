import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import TopCategoryEditor from "../../components/top-category-editor"

// Mirrors this page's fields so a dropped connection or an expired
// session can't wipe what has been typed (lib/draft-keeper.ts).
import "../../lib/draft-keeper"

/**
 * Store Page editor — mirrors the Homepage editor, for the /store page.
 *
 * v1: choose which categories appear in the top category bar on the Store
 * page (independent of the homepage's top bar). Built to grow — more Store
 * page blocks (featured collections, filters, banners) can be added here.
 *
 * The top-category selection is stored in site_settings under
 * `store_top_categories` and read by the storefront's
 * CategoryCarouselServer on /store.
 */
const StorePageEditor = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <Heading level="h1">Store Page</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Control how the Store (/store) page looks. Right now you can choose
          which categories appear in its top category bar.
        </Text>
      </Container>

      <TopCategoryEditor
        settingKey="store_top_categories"
        title="Top Category Bar (Store page)"
        description="Pick which categories show in the top category rail on the Store page, and in what order. Leave empty to show all top-level categories automatically."
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Store Page",
})

export default StorePageEditor
