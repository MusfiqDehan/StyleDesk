"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Home, Scissors, Package, UserCircle, CalendarDays } from "lucide-react"
import { useBooking } from "@/context/BookingContext"

function getUserFromToken(token: string): { role?: string } | null {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return { role: decoded.role }
  } catch {
    return null
  }
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const { openBooking } = useBooking()
  const [accountHref, setAccountHref] = useState("/login")

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (token) {
      const user = getUserFromToken(token)
      if (user) setAccountHref("/account-settings")
    }
  }, [])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const NavTab = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string
    label: string
    icon: React.ElementType
  }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className="relative flex flex-1 flex-col items-center justify-center gap-1.5 h-full"
      >
        <Icon
          size={20}
          strokeWidth={active ? 2 : 1.5}
          className={`transition-colors duration-150 ${active ? "text-[#eccd80]" : "text-white/75"}`}
        />
        <span
          className={`text-[9px] uppercase tracking-[0.18em] leading-none transition-colors duration-150 ${active ? "text-[#eccd80]" : "text-white/65"}`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {label}
        </span>
        {/* Active pill at bottom edge */}
        {active && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-[#eccd80]/70" />
        )}
      </Link>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Subtle glow line at the top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#eccd80]/20 to-transparent" />

      <div
        className="relative flex items-stretch h-[60px] border-t border-white/[0.07] backdrop-blur-xl"
        style={{ background: "rgba(8,8,8,0.97)" }}
      >
        {/* Home */}
        <NavTab href="/" label="Home" icon={Home} />

        {/* Services */}
        <NavTab href="/services" label="Services" icon={Scissors} />

        {/* ── Center Book CTA ── */}
        <div className="relative flex flex-1 flex-col items-center justify-end gap-1.5 pb-2">
          <button
            type="button"
            onClick={() => openBooking()}
            aria-label="Book appointment"
            className="relative flex items-center justify-center rounded-full transition-all duration-200 active:scale-95"
            style={{
              width: 50,
              height: 50,
              marginBottom: 8,
              marginTop: -18,
              background: "linear-gradient(145deg, #eccd80 0%, #c9a84c 100%)",
              boxShadow: "0 0 0 3px rgba(8,8,8,0.97), 0 6px 20px rgba(236,205,128,0.40)",
            }}
          >
            <CalendarDays size={21} strokeWidth={2} className="text-[#0b0b0b]" />
          </button>
          <span
            className="text-[9px] uppercase tracking-[0.18em] leading-none text-white/65"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Book
          </span>
        </div>

        {/* Packages */}
        <NavTab href="/packages" label="Packages" icon={Package} />

        {/* Account */}
        <NavTab href={accountHref} label="Account" icon={UserCircle} />
      </div>
    </nav>
  )
}
