"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/** Reset scroll position on route change (e.g. home footer CTA → /services top). */
export function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return null
}
