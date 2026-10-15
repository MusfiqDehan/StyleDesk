"use client"

import { useSyncExternalStore } from "react"
import { type User, getAccessToken } from "@admin/lib/auth-utils"
import { createAuthStore } from "@admin/lib/auth-store"
import { consoleApi } from "@/lib/console-api"
import { selectedBranch } from "@/lib/branch-selection"

const auth = createAuthStore<User>({
  getScope: () => {
    if (typeof window === "undefined") return null
    const token = getAccessToken()
    return token ? JSON.stringify([window.location.host, token, selectedBranch()]) : null
  },
  loadUser: async () => {
    const data = await consoleApi("/access/bootstrap")
    return { ...data.user, permissions: data.permissions, features: data.features, operational: data.operational, catalog: data.catalog }
  },
  isVisible: () => document.visibilityState !== "hidden",
  listen: (refresh) => {
    const onVisibility = () => { if (document.visibilityState === "visible") refresh() }
    window.addEventListener("focus", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener("branch-changed", refresh)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener("branch-changed", refresh)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  },
})

export function useAuth() {
  return useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getServerSnapshot)
}
