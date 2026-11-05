import KhanBabaCardClient from "./khanbaba-client"
import type { ProductCardProps } from "./types"

/**
 * Server half of the Khan Baba card. The card itself is interactive (size
 * buttons + add to cart), so the product is sent to the browser — but only
 * the few fields the card uses. The full product carries the long HTML
 * description, FAQ schema and SEO metadata, which would otherwise be
 * repeated in the page payload for every card on the page.
 */
export default function KhanBabaCard(props: ProductCardProps) {
  const p = props.product
  const product = {
    id: p.id,
    title: p.title,
    handle: p.handle,
    thumbnail: p.thumbnail,
    images: (p.images ?? []).slice(0, 2).map((i) => ({ id: i.id, url: i.url })),
    metadata: { default_size: (p.metadata as any)?.default_size ?? null },
    options: (p.options ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      values: (o.values ?? []).map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      options: (v.options ?? []).map((o: any) => ({ id: o.id, option_id: o.option_id, value: o.value })),
      calculated_price: (v as any).calculated_price,
    })),
  } as unknown as ProductCardProps["product"]

  // `region` is not used by the card; leave it out of the payload too.
  return <KhanBabaCardClient {...props} product={product} region={undefined as any} />
}
