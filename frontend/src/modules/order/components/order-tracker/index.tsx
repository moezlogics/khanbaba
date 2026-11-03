import React from "react"
import { HttpTypes } from "@medusajs/types"

type OrderTrackerProps = {
  order: HttpTypes.StoreOrder
}

export default function OrderTracker({ order }: OrderTrackerProps) {
  const fStatus = order.fulfillment_status as string | undefined
  const pStatus = order.payment_status as string | undefined
  const meta = ((order as any).metadata || {}) as Record<string, any>
  const isCanceled = order.status === "canceled"

  /**
   * Where the order actually is, read from its real state.
   *
   * The old tracker marked "Order Confirmed" done and "Shipped Out" as the
   * CURRENT step for every brand-new order, so a customer saw "shipped"
   * seconds after checkout. A fresh order is waiting for the store to
   * confirm it; each later stage only lights up once the order really
   * reaches it.
   *
   *   0 awaiting confirmation — just placed
   *   1 confirmed             — store marked it confirmed, or started
   *                             fulfilling it, or captured payment
   *   2 shipped               — handed to the courier
   *   3 delivered
   */
  const stage = (() => {
    if (order.status === "completed" || fStatus === "delivered" || fStatus === "partially_delivered") return 3
    if (fStatus === "shipped" || fStatus === "partially_shipped") return 2
    if (
      fStatus === "fulfilled" ||
      fStatus === "partially_fulfilled" ||
      pStatus === "captured" ||
      pStatus === "partially_captured" ||
      meta.confirmed === true ||
      meta.confirmed === "true"
    ) {
      return 1
    }
    return 0
  })()

  const getStepStatus = (stepIndex: number): "completed" | "current" | "upcoming" | "canceled" => {
    if (isCanceled) return "canceled"
    if (stage === 3) return "completed"
    if (stepIndex < stage) return "completed"
    if (stepIndex === stage) return "current"
    return "upcoming"
  }

  const steps = [
    {
      title: "Awaiting Confirmation",
      description: "We've received your order and will confirm it shortly.",
      icon: "ph-bold ph-hourglass-medium",
    },
    {
      title: "Confirmed",
      description: "Your order is confirmed and being prepared.",
      icon: "ph-bold ph-receipt",
    },
    {
      title: "Shipped Out",
      description: "Your package is on its way to you.",
      icon: "ph-bold ph-truck",
    },
    {
      title: "Delivered",
      description: "Delivered to your shipping address.",
      icon: "ph-bold ph-check-circle",
    },
  ]

  // Reason the store recorded when canceling (order.metadata.cancel_reason),
  // e.g. "This item went out of stock". Only shown when it was set.
  const cancelReason =
    typeof meta.cancel_reason === "string" && meta.cancel_reason.trim()
      ? meta.cancel_reason.trim()
      : null

  const getOverallStatusMessage = () => {
    if (isCanceled) return "Order Canceled"
    return ["Awaiting Confirmation", "Confirmed", "Shipped", "Delivered"][stage]
  }

  const getStatusBadgeClass = () => {
    if (isCanceled) return "bg-danger/10 text-danger border border-danger/20"
    if (stage === 3) return "bg-success/10 text-success border border-success/20"
    if (stage >= 1) return "bg-info/10 text-info border border-info/20"
    return "bg-warning/10 text-warning border border-warning/20"
  }

  // Share of the track between the first and last step that is filled.
  const progressPct = isCanceled ? 0 : Math.round((stage / (steps.length - 1)) * 100)

  return (
    <div className="w-full space-y-4">
      {/* Sleek App-like Status Overview Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-surface border border-line/35 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full tracking-wide ${getStatusBadgeClass()}`}>
            <span className="relative flex h-2 w-2">
              {order.status !== "canceled" && order.status !== "completed" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
            {getOverallStatusMessage()}
          </span>
          <div className="h-4 w-[1px] bg-line/50 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-xs text-ink/70">
            <span>Order ID:</span>
            <span className="font-bold text-ink font-mono bg-surface-alt/10 px-2 py-0.5 rounded border border-line/20">{order.display_id}</span>
          </div>
        </div>
      </div>

      {isCanceled && cancelReason && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/20 bg-danger/5">
          <i className="ph-bold ph-warning-circle text-danger text-lg shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-danger">This order was canceled</p>
            <p className="text-ink/75 mt-0.5">{cancelReason}</p>
          </div>
        </div>
      )}

      {/* Stepper Card */}
      <div className="p-6 sm:p-8 bg-surface border border-line/35 rounded-3xl shadow-sm relative overflow-hidden">
        {/* Desktop View (Horizontal) */}
        <div className="hidden md:flex items-start justify-between relative w-full pt-4 pb-2 z-10">
          {/* Background track line */}
          <div className="absolute top-[28px] left-[12.5%] right-[12.5%] h-[3px] bg-line/25 -z-10 rounded-full">
            {/* Active progress fill line */}
            <div 
              className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-700 ease-in-out" 
              style={{
                width: `${progressPct}%`
              }}
            />
          </div>

          {steps.map((step, idx) => {
            const status = getStepStatus(idx)
            return (
              <div key={idx} className="flex flex-col items-center text-center w-1/4 px-2">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                    status === "completed" 
                      ? "bg-success text-white shadow-md shadow-success/10 border border-transparent scale-105" 
                      : status === "current"
                      ? "bg-primary text-primary-fg ring-4 ring-primary/10 shadow-sm border border-transparent scale-105"
                      : status === "canceled"
                      ? "bg-danger text-white shadow-md"
                      : "bg-surface-alt text-ink/30 border border-line/40"
                  }`}
                >
                  <i className={`${step.icon} text-lg`} />
                  {status === "completed" && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-success text-white rounded-full p-0.5 border border-surface shadow-xs">
                      <i className="ph-bold ph-check text-[8px]" />
                    </span>
                  )}
                </div>

                <h4 className={`text-xs font-bold mt-3 transition-colors duration-300 ${
                  status === "completed" ? "text-ink" : status === "current" ? "text-primary" : "text-ink/40"
                }`}>
                  {step.title}
                </h4>
                <p className="text-[10px] text-ink/50 mt-1 max-w-[140px] leading-relaxed">
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Mobile View (Vertical - App Like) */}
        <div className="md:hidden flex flex-col relative pl-2 z-10">
          {/* Background vertical line */}
          <div className="absolute top-5 bottom-5 left-[24px] w-[2px] bg-line/25 -z-10">
            {/* Active vertical line */}
            <div 
              className="w-full bg-gradient-to-b from-primary to-success transition-all duration-700 ease-in-out rounded-full" 
              style={{
                height: `${progressPct}%`
              }}
            />
          </div>

          <div className="space-y-8">
            {steps.map((step, idx) => {
              const status = getStepStatus(idx)
              return (
                <div key={idx} className="flex gap-4 items-start">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 relative ${
                      status === "completed" 
                        ? "bg-success text-white shadow-sm shadow-success/15 border border-transparent" 
                        : status === "current"
                        ? "bg-primary text-primary-fg ring-4 ring-primary/10 shadow-sm border border-transparent"
                        : status === "canceled"
                        ? "bg-danger text-white shadow-sm"
                        : "bg-surface-alt text-ink/30 border border-line/45"
                    }`}
                  >
                    <i className={`${step.icon} text-base`} />
                    {status === "completed" && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-success text-white rounded-full p-0.5 border border-surface shadow-xs">
                        <i className="ph-bold ph-check text-[7px]" />
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col pt-1">
                    <h4 className={`text-xs font-bold transition-colors ${
                      status === "completed" ? "text-ink" : status === "current" ? "text-primary" : "text-ink/40"
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-ink/50 mt-0.5 leading-relaxed max-w-xs">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

