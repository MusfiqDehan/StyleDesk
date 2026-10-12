"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Menu } from "lucide-react"
import { Sidebar } from "./sidebar"
import { NotificationProvider } from "@admin/context/notification-context"
import { FaviconUpdater } from "./favicon-updater"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "./notification-bell"
import "./tenant-admin.css"

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const fullscreen = pathname.startsWith("/admin/pos")
  const currentPage = pathname.startsWith("/admin/clients/")
    ? (pathname.endsWith("/due-payment") ? "Due payment" : "Client details")
    : pathname.split("/").filter(Boolean).slice(1).map((segment) =>
      segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    ).at(-1) || "Overview"

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false) }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const navigation = document.getElementById("tenant-navigation")
    const focusable = () => Array.from(navigation?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"], input:not([disabled])'
    ) ?? []).filter((element) => element.getClientRects().length && !element.closest('[inert]'))
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false)
      if (event.key !== "Tab") return
      const elements = focusable()
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      menuButton.current?.focus()
    }
  }, [sidebarOpen])

  return (
    <>
      <FaviconUpdater />
      <div className="admin-root" data-collapsed={collapsed} data-fullscreen={fullscreen}>
        {!fullscreen && <>
          {sidebarOpen && <button type="button" className="admin-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
          <Sidebar isOpen={sidebarOpen} collapsed={collapsed && !sidebarOpen} onCollapseChange={setCollapsed} onClose={() => setSidebarOpen(false)} />
        </>}
        <div className="admin-workspace" inert={sidebarOpen ? true : undefined}>
          {!fullscreen && (
            <div className="admin-topbar">
              <div className="flex min-w-0 items-center gap-3 text-xs text-brand-muted">
                <button ref={menuButton} type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="tenant-navigation" onClick={() => setSidebarOpen(true)} className="admin-menu-toggle">
                  <Menu className="size-5" />
                </button>
                <Link href="/admin" className="hidden shrink-0 hover:text-brand-text sm:block">Workspace</Link>
                <ChevronRight className="hidden size-3.5 shrink-0 sm:block" aria-hidden />
                <span className="truncate font-semibold text-brand-ink">{currentPage}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2"><NotificationBell /><ThemeToggle /></div>
            </div>
          )}
          <main id="admin-main-content" className={fullscreen ? "admin-pos-content" : "admin-content"}>{children}</main>
        </div>
      </div>
    </>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <NotificationProvider><DashboardLayoutInner>{children}</DashboardLayoutInner></NotificationProvider>
}
