"use client"

import { addToCart } from "@lib/data/cart"
import { trackAddToCart } from "@lib/analytics"
import { notifyCartUpdated } from "@lib/context/user-data-context"
import { useCartDrawer } from "@lib/context/cart-drawer-context"

import { HttpTypes } from "@medusajs/types"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"

import { useRouter } from "next/navigation"
import OptionSelect from "@modules/products/components/product-actions/option-select"

import QuantityStepper from "../quantity-stepper"

import WhatsAppOrderButton from "@modules/common/components/whatsapp-button"
import { getPreorderState } from "@lib/util/preorder"
import ProductTrustBadges from "@modules/products/components/product-trust-badges"
import SizeCards, { isWeightOption } from "./size-cards"
import DeliveryInfo from "./delivery-info"
import { convertToLocale } from "@lib/util/money"
import { getProductPath } from "@lib/util/product"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  whatsappNumber?: string
  whatsappBuyNowEnabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

/**
 * PDP buy box, ordered for conversion: price (with savings) → pack sizes
 * with per-size and per-kg prices → quantity + stock → Add to Cart /
 * Buy Now → delivery dates + free-delivery progress → WhatsApp → trust
 * tiles, plus a sticky buy bar on phones.
 *
 * Buy It Now → goes DIRECTLY to checkout (not cart page).
 */
export default function ProductActions({
  product,
  disabled,
  whatsappNumber,
  whatsappBuyNowEnabled = true,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const searchParams = useSearchParams()
  const vId = searchParams.get("v_id")

  const [options, setOptions] = useState<Record<string, string | undefined>>(() => {
    const variants = product.variants ?? []
    if (variants.length === 0) return {}

    if (variants.length <= 1) {
      const first = variants[0]
      return optionsAsKeymap(first.options) ?? {}
    }

    // Pre-select the default pack size the way WordPress did (its
    // "default" attribute, imported as metadata.default_size), else the
    // first — smallest — size. The URL only gains ?v_id once the shopper
    // picks a size themselves (see `userPicked` below).
    const defaultSize = (product.metadata as any)?.default_size
    const preferred =
      (defaultSize &&
        variants.find((v) =>
          (v.options ?? []).some((o: any) => o.value === defaultSize)
        )) ||
      variants[0]
    return optionsAsKeymap(preferred.options) ?? {}
  })
  // True once the shopper has chosen a size, so the pre-selected default
  // never writes ?v_id into a freshly opened product URL.
  const userPicked = useRef(false)
  const [qty, setQty] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const countryCode = useParams().countryCode as string
  // Slide the cart in after an add (no-op when the drawer is disabled in
  // Site Settings, since it is then not rendered).
  const { open: openCartDrawer } = useCartDrawer()

  // Manage body class for hiding bottom nav on PDP
  useEffect(() => {
    document.body.classList.add("is-pdp-page")
    return () => {
      document.body.classList.remove("is-pdp-page")
    }
  }, [])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }
    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) => {
    userPicked.current = true
    setOptions((prev) => ({ ...prev, [optionId]: value }))
  }

  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // ── Sync options ↔ URL ?v_id= (flicker-free custom events) ─────────────
  //
  // Both mobile and desktop layout ProductActions instances and the ImageGallery
  // sync their options and images using custom window events. This avoids calling Next.js
  // router.replace() or modifying Next.js history state, which triggers a server re-render
  // and makes the variant URL params or strings flash/disappear.
  //
  // Phase 1 — url → options: run once on initial mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlVId = params.get("v_id")

    if (!urlVId) {
      // No v_id in URL: keep the default size and a clean URL.
      return
    }

    const target = product.variants?.find((v) => v.id === urlVId)
    if (!target) return
    const targetOpts = optionsAsKeymap(target.options) ?? {}
    if (!isEqual(options, targetOpts)) {
      setOptions(targetOpts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase 2 — listen for external variant-change events to stay in sync
  useEffect(() => {
    const handleVariantChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      const targetId = customEvent.detail
      if (!targetId || targetId === selectedVariant?.id) return

      const target = product.variants?.find((v) => v.id === targetId)
      if (!target) return
      const targetOpts = optionsAsKeymap(target.options) ?? {}
      if (!isEqual(options, targetOpts)) {
        setOptions(targetOpts)
      }
    }
    window.addEventListener("variant-change", handleVariantChange)
    return () => window.removeEventListener("variant-change", handleVariantChange)
  }, [selectedVariant, options, product.variants])

  // Phase 3 — options → url: dispatch event & update URL on user selection
  useEffect(() => {
    if ((product.variants?.length ?? 0) <= 1) return
    if (!selectedVariant?.id) return
    if (!userPicked.current) return

    const params = new URLSearchParams(window.location.search)
    if (params.get("v_id") === selectedVariant.id) return

    params.set("v_id", selectedVariant.id)
    const qs = params.toString()
    window.history.replaceState(null, "", `${pathname}?${qs}`)
    window.dispatchEvent(new CustomEvent("variant-change", { detail: selectedVariant.id }))
  }, [selectedVariant, pathname, product.variants])

  const inStock = useMemo(() => {
    if (selectedVariant && !selectedVariant.manage_inventory) return true
    if (selectedVariant?.allow_backorder) return true
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }
    return false
  }, [selectedVariant])

  // Pre-order state from product metadata. When active we swap CTA
  // labels ("Add to Cart" → "Pre-order Now", "Buy Now" →
  // "Pre-order & Pay") and bypass the stock check so the buttons
  // remain enabled even when inventory is zero pre-launch.
  const preorder = useMemo(
    () => getPreorderState(product.metadata),
    [product.metadata]
  )

  const stockQty = selectedVariant?.inventory_quantity ?? 0
  const stockLabel = useMemo(() => {
    if (!selectedVariant) return null
    if (!inStock)
      return { text: "Out of stock", className: "bg-danger/10 text-danger" }
    if (
      selectedVariant.manage_inventory &&
      !selectedVariant.allow_backorder &&
      stockQty > 0 &&
      stockQty <= 10
    ) {
      return {
        text: `Only ${stockQty} left`,
        className: "bg-warning/15 text-warning",
      }
    }
    return { text: "In stock", className: "bg-success/10 text-success" }
  }, [selectedVariant, inStock, stockQty])

  const actionsRef = useRef<HTMLDivElement>(null)
  const buyButtonsRef = useRef<HTMLDivElement>(null)
  // The sticky bar only shows once the main buttons have scrolled off.
  const [showStickyBar, setShowStickyBar] = useState(false)
  useEffect(() => {
    const el = buyButtonsRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const performAddToCart = async () => {
    if (!selectedVariant?.id) return
    await addToCart({
      variantId: selectedVariant.id,
      quantity: qty,
      countryCode,
    })
    notifyCartUpdated()
    trackAddToCart({
      id: product.id,
      title: product.title || "",
      variant: selectedVariant.title || "",
      price: selectedVariant.calculated_price?.calculated_amount || 0,
      quantity: qty,
      currency: selectedVariant.calculated_price?.currency_code || "usd",
    })
  }

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null
    setIsAdding(true)
    try {
      await performAddToCart()
      openCartDrawer()
    } finally {
      setIsAdding(false)
    }
  }

  // Buy It Now → add to cart then go DIRECTLY to checkout
  const handleBuyItNow = async () => {
    if (!selectedVariant?.id) return
    setIsBuyingNow(true)
    try {
      await performAddToCart()
      router.push(`/${countryCode}/checkout`)
    } finally {
      setIsBuyingNow(false)
    }
  }

  // For pre-order products the inventory check is intentionally
  // ignored — admins use pre-order specifically because stock isn't
  // available yet. They still need a selected, valid variant though.
  const disabledAdd =
    (!preorder.isPreorder && !inStock) ||
    !selectedVariant ||
    !!disabled ||
    isAdding ||
    !isValidVariant

  // Sticky Bar button labels and disabling states
  const stickyButtonText = useMemo(() => {
    if (!selectedVariant && (product.variants?.length ?? 0) > 1) {
      return "Select size"
    }
    if (preorder.isPreorder) {
      return "Pre-order Now"
    }
    if (!inStock || (selectedVariant && !isValidVariant)) {
      return "Out of stock"
    }
    return "Add to Cart"
  }, [selectedVariant, product.variants, preorder.isPreorder, inStock, isValidVariant])

  const disabledStickyAdd =
    (selectedVariant && !preorder.isPreorder && !inStock) ||
    (selectedVariant && !isValidVariant) ||
    !!disabled ||
    isAdding

  const handleStickyAddToCart = async () => {
    if (!selectedVariant) {
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    await handleAddToCart()
  }

  // ── Selling toggle (admin: product.metadata.for_sale) ──────────────
  // Enabled by default (unset / null / undefined / true). Only disabled when
  // explicitly configured as false / "false" in metadata.
  const forSale =
    (product.metadata as any)?.for_sale !== false &&
    (product.metadata as any)?.for_sale !== "false"

  // Weight-based packs get the price-per-size cards; anything else falls
  // back to the generic option chips.
  const weightOption =
    (product.options?.length ?? 0) === 1 && isWeightOption(product.options![0])
      ? product.options![0]
      : null

  const unitPrice: number | null =
    (selectedVariant as any)?.calculated_price?.calculated_amount ?? null
  const currency: string =
    (selectedVariant as any)?.calculated_price?.currency_code ||
    (product.variants?.[0] as any)?.calculated_price?.currency_code ||
    "pkr"

  return (
    <div className="flex flex-col gap-4" ref={actionsRef}>
      <ProductPrice product={product} variant={selectedVariant} size="lg" />

      {(product.variants?.length ?? 0) > 1 &&
        (weightOption ? (
          <SizeCards
            option={weightOption}
            variants={product.variants ?? []}
            current={options[weightOption.id]}
            onSelect={setOptionValue}
            disabled={!!disabled || isAdding}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {(product.options || []).map((option) => (
              <OptionSelect
                key={option.id}
                option={option}
                current={options[option.id]}
                updateOption={setOptionValue}
                title={option.title ?? ""}
                data-testid="product-options"
                disabled={!!disabled || isAdding}
              />
            ))}
          </div>
        ))}

      {forSale && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-ink">Quantity</span>
              <QuantityStepper
                value={qty}
                onChange={setQty}
                min={1}
                max={Math.max(1, Math.min(99, inStock ? stockQty || 99 : 1))}
                disabled={!!disabled || isAdding || !inStock}
              />
            </div>
            {stockLabel && (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink/70">
                <span className="relative flex h-2 w-2">
                  {!preorder.isPreorder && inStock && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      stockLabel.text.startsWith("Only") ? "bg-warning" : "bg-success"
                    }`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    !inStock ? "bg-danger" : stockLabel.text.startsWith("Only") ? "bg-warning" : "bg-success"
                  }`} />
                </span>
                {stockLabel.text}
              </span>
            )}
          </div>

          <div ref={buyButtonsRef} className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={disabledAdd}
              data-testid="add-product-button"
              className="inline-flex items-center justify-center gap-1.5 h-[52px] px-4 rounded-[var(--radius-btn)] bg-bg border-2 border-primary text-primary text-[15px] font-bold transition-all duration-200 hover:bg-primary/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? (
                <>
                  <i className="ph-bold ph-spinner animate-spin text-sm" aria-hidden />
                  {preorder.isPreorder ? "Reserving…" : "Adding…"}
                </>
              ) : !selectedVariant ? (
                "Select size"
              ) : preorder.isPreorder ? (
                "Pre-order Now"
              ) : !inStock || !isValidVariant ? (
                "Out of stock"
              ) : (
                <>
                  <i className="ph-bold ph-shopping-bag text-[17px]" aria-hidden />
                  Add to Cart
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleBuyItNow}
              disabled={disabledAdd || isBuyingNow}
              className="inline-flex items-center justify-center gap-1.5 h-[52px] px-4 rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[15px] font-bold shadow-[0_10px_24px_-12px_rgb(var(--color-primary)/0.9)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBuyingNow ? (
                <>
                  <i className="ph-bold ph-spinner animate-spin text-sm" aria-hidden />
                  Processing…
                </>
              ) : preorder.isPreorder ? (
                "Pre-order & Pay"
              ) : (
                <>
                  Buy Now
                  <i className="ph-bold ph-lightning text-[16px]" aria-hidden />
                </>
              )}
            </button>
          </div>

          <DeliveryInfo subtotal={unitPrice !== null ? unitPrice * qty : null} currency={currency} />

          {whatsappNumber && whatsappBuyNowEnabled && (
            <WhatsAppOrderButton
              productTitle={product.title || ""}
              productPath={getProductPath(product)}
              whatsappNumber={whatsappNumber}
              selection={
                selectedVariant
                  ? `${selectedVariant.title}${
                      unitPrice !== null
                        ? ` — ${convertToLocale({ amount: unitPrice, currency_code: currency, maximumFractionDigits: 0 })}`
                        : ""
                    }`
                  : undefined
              }
              quantity={qty}
            />
          )}
        </>
      )}

      <ProductTrustBadges />

      {/* Mobile sticky buy bar — slides in once the main buttons scroll
          out of view, so the CTA is always one tap away without doubling
          up while the real buttons are on screen. */}
      {forSale && (
        <div
          className={`small:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-bg/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] transition-transform duration-300 ${
            showStickyBar ? "translate-y-0" : "translate-y-full"
          }`}
          aria-hidden={!showStickyBar}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-ink/60">
                {selectedVariant ? `${product.title} · ${selectedVariant.title}` : product.title}
              </p>
              <p className="text-[16px] font-extrabold leading-tight text-primary" suppressHydrationWarning>
                {unitPrice !== null
                  ? convertToLocale({ amount: unitPrice * qty, currency_code: currency, maximumFractionDigits: 0 })
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStickyAddToCart}
              disabled={disabledStickyAdd}
              tabIndex={showStickyBar ? 0 : -1}
              className="h-11 shrink-0 px-5 rounded-[var(--radius-btn)] bg-primary text-primary-fg text-[14px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? (
                <>
                  <i className="ph-bold ph-spinner animate-spin text-xs" aria-hidden />
                  Adding…
                </>
              ) : (
                <>
                  <i className="ph-bold ph-shopping-bag text-[15px]" aria-hidden />
                  {stickyButtonText}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
