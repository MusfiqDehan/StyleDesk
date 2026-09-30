"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { getBusinessInfo, BusinessInfo } from "@admin/api/settings/settings"
import { DEFAULT_BUSINESS_NAME, resolveBusinessName } from "@/lib/business-branding"

import { getBrandTheme } from "@/lib/brand-theme"

type ConnectionStatus = "loading" | "connected" | "unavailable"

interface BusinessContextValue {
  connectionStatus: ConnectionStatus
  businessInfo: BusinessInfo | null
  businessName: string
  refresh: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextValue>({
  connectionStatus: "loading",
  businessInfo: null,
  businessName: DEFAULT_BUSINESS_NAME,
  refresh: async () => { },
})

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("loading")
  const refreshing = useRef(false)
  const lastAttempt = useRef(0)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME)

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    lastAttempt.current = Date.now()
    setConnectionStatus("loading")
    try {
      const info = await getBusinessInfo()
      setConnectionStatus("connected")
      if (info) {
        setBusinessInfo(info)
        if (info.businessName) {
          setBusinessName(resolveBusinessName(info.businessName))
        }
      }
    } catch {
      // Branding is optional: keep the last successful theme and expose a
      // recoverable connection state instead of a development error overlay.
      setConnectionStatus("unavailable")
    } finally {
      refreshing.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const onFocus = () => { if (Date.now() - lastAttempt.current > 30000) void refresh() }
    const onOnline = () => { void refresh() }
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("online", onOnline)
    }
  }, [refresh])

  useEffect(() => {
    const theme = getBrandTheme(businessInfo?.primaryColor)
    document.documentElement.style.setProperty("--brand-primary", theme.primary)
    document.documentElement.style.setProperty("--brand-on-primary", theme.foreground)
    document.documentElement.style.setProperty("--brand-base-text", theme.text)
  }, [businessInfo?.primaryColor])

  return (
    <BusinessContext.Provider value={{ businessInfo, businessName, refresh, connectionStatus }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
