"use client"

import { useEffect } from "react"

/** Design canvas width used as the 1.0 scale reference */
const DESIGN_WIDTH = 1440
/** Below this, keep native responsive layout (no global zoom) */
const MOBILE_MAX = 1023
const MIN_SCALE = 0.82
const MAX_SCALE = 1.12

/** Full-viewport auth screens — zoom would create a pointless scrollbar */
const NO_SCALE_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]
/** Public marketing pages already use their own responsive layouts */
const PUBLIC_PAGE_PREFIXES = ["/", "/services", "/packages", "/our-team", "/about-us", "/contact", "/customer-dashboard", "/account-settings"]

function shouldSkipAppScale(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  const isPublicPage = PUBLIC_PAGE_PREFIXES.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  )
  return isPublicPage || NO_SCALE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function computeAppScale(width: number): number {
  if (width <= MOBILE_MAX) return 1
  const raw = width / DESIGN_WIDTH
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
}

export function applyAppScale(width = typeof window !== "undefined" ? window.innerWidth : DESIGN_WIDTH) {
  if (typeof document === "undefined") return 1
  const scale = shouldSkipAppScale() ? 1 : computeAppScale(width)
  const root = document.documentElement
  root.style.setProperty("--app-scale", String(scale))
  root.style.zoom = String(scale)
  root.dataset.appScale = scale.toFixed(3)
  return scale
}

/**
 * Scales the whole app UI to the window width so 100% browser zoom
 * fits laptop screens (scale down) and larger monitors (scale up).
 * Phones/tablets keep scale 1 and use existing responsive layouts.
 */
export function ViewportFit({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const update = () => applyAppScale(window.innerWidth)
    update()

    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    window.addEventListener("resize", onResize, { passive: true })
    window.addEventListener("orientationchange", update)

    // Re-apply after fonts/layout settle
    const t = window.setTimeout(update, 100)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(t)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", update)
    }
  }, [])

  return <>{children}</>
}
