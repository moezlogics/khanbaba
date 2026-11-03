"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Floating WhatsApp Channel widget — bottom-right green bubble.
 * Promotes the official WhatsApp channel with eye-catching animations and a teaser bubble.
 */
export default function WhatsAppChannelWidget({ channelUrl }: { channelUrl: string }) {
  const pathname = usePathname() || "/"
  const [showBubble, setShowBubble] = useState(false)
  const [hasClosed, setHasClosed] = useState(true)

  // Hide on checkout, admin, etc.
  const hide = /\/checkout|\/admin/i.test(pathname)

  useEffect(() => {
    if (hide) return

    setHasClosed(false)
    setShowBubble(false)

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640
    const delay = isMobile ? 4000 : 13000

    const timer = setTimeout(() => {
      setShowBubble(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [hide, pathname])

  if (hide) return null

  const handleCloseBubble = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowBubble(false)
    setHasClosed(true)
  }

  const STORE_ICON = "/khanbaba-icon.png"

  return (
    <>
      <div className="fixed z-[55] flex flex-col items-end gap-2.5 sm:gap-4 transition-all duration-300 bottom-[64px] right-4 sm:bottom-6 sm:right-[92px]">
        {/* Teaser Message Bubble */}
        {showBubble && !hasClosed && (
          <div
            className="flex items-center gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.15)] px-3.5 py-3 rounded-2xl max-w-[280px] sm:max-w-xs relative border border-line bg-surface border-l-4 border-l-[#25D366]"
            style={{
              animation: "waBubbleIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              transformOrigin: "bottom right",
            }}
          >
            {/* Pointer arrow */}
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-surface border-r border-b border-line rotate-45" />

            {/* Store icon */}
            <img
              src={STORE_ICON}
              alt="Khan Baba"
              className="w-8 h-8 rounded-full object-cover shrink-0"
              style={{ border: "2px solid #25D366" }}
            />

            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-ink leading-snug block">
                Follow Khan Baba on WhatsApp for exclusive deals & price alerts! 💚
              </span>
            </div>

            <button
              type="button"
              onClick={handleCloseBubble}
              className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90 opacity-40 hover:opacity-100 hover:bg-neutral-200/50"
              aria-label="Close message"
            >
              <i className="ph-bold ph-x text-[10px]" />
            </button>
          </div>
        )}

        {/* Floating WhatsApp Logo Button */}
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow Khan Baba on WhatsApp Channel"
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_24px_rgba(37,211,102,0.35)] hover:shadow-[0_8px_30px_rgba(37,211,102,0.55)] hover:scale-110 active:scale-95 transition-all duration-300"
          style={{
            backgroundColor: "#25D366",
            animation: "waFloatAndPlayfulBounce 6s ease-in-out infinite",
          }}
        >
          {/* Animated Pulse Ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#25D366] pointer-events-none" />

          {/* SVG WhatsApp Official Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="#ffffff"
            className="w-7 h-7 relative z-10 transition-transform duration-300 hover:rotate-12"
            aria-hidden
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      </div>

      <style>{`
        @keyframes waBubbleIn {
          0% { opacity: 0; transform: scale(0.8) translateY(12px); }
          60% { opacity: 1; transform: scale(1.03) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes waFloatAndPlayfulBounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          60% { transform: translateY(0); }
          /* Bouncy double-pop sequence */
          74% { transform: translateY(-12px) scaleY(1.06); }
          80% { transform: translateY(0) scaleY(0.96); }
          86% { transform: translateY(-5px) scaleY(1.02); }
          92% { transform: translateY(0) scaleY(1); }
        }
      `}</style>
    </>
  )
}
