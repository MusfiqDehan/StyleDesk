"use client"

import { useEffect } from "react"
import { useBusiness } from "@/context/BusinessContext"
import { resolveLogoUrl } from "@/lib/business-branding"

/**
 * Dynamically updates the browser tab favicon + page title
 * using the real business logo and name from settings.
 * Renders nothing — purely a side-effect component.
 */
export function FaviconUpdater() {
  const { businessInfo, businessName } = useBusiness()

  // Update favicon whenever the logo URL changes
  useEffect(() => {
    const logoUrl = businessInfo?.logoUrl
    const href = logoUrl ? resolveLogoUrl(logoUrl) : '/brand/tenant/salon-icon.svg'

    // Update or create <link rel="icon">
    const selectors = [
      "link[rel='icon']",
      "link[rel='shortcut icon']",
      "link[rel='apple-touch-icon']",
    ]

    selectors.forEach((sel, i) => {
      let link = document.querySelector(sel) as HTMLLinkElement | null
      if (!link) {
        link = document.createElement("link")
        link.rel = i === 0 ? "icon" : i === 1 ? "shortcut icon" : "apple-touch-icon"
        document.head.appendChild(link)
      }
      link.removeAttribute('type')
      link.href = `${href}?v=${Date.now()}`
    })
  }, [businessInfo?.logoUrl])

  // Update <title> to use the real business name
  useEffect(() => {
    if (!businessName) return
    document.title = `${businessName} — Salon Workspace`
  }, [businessName])

  return null
}
