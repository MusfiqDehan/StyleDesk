"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationBell } from "../notification-bell"

export interface PageHeaderBreadcrumb {
  label: string
  href?: string
}

export type PageHeaderChipTone = "default" | "info" | "success" | "warning"

export interface PageHeaderChip {
  label: string
  tone?: PageHeaderChipTone
}

const CHIP_STYLES: Record<PageHeaderChipTone, string> = {
  default: "border-[var(--brand-line)] bg-[var(--brand-mist)] text-[var(--brand-muted)]",
  info: "border-brand-primary/20 bg-brand-soft text-brand-primary",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
}

export interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Small label above the title (e.g. section name) */
  eyebrow?: string
  breadcrumbs?: PageHeaderBreadcrumb[]
  chips?: PageHeaderChip[]
  actions?: React.ReactNode
  showNotificationBell?: boolean
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  chips,
  actions,
  showNotificationBell = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "admin-page-header mb-6 min-w-0 border-b border-brand-line pb-6",
        className,
      )}
    >
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-[var(--brand-muted)]">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="font-medium text-[var(--brand-muted)] transition-colors hover:text-brand-primary"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn("font-medium", isLast && "text-[var(--brand-ink)]")}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="size-3.5 text-[#94a3b8]" aria-hidden />}
                </span>
              )
            })}
          </nav>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[11px] font-medium text-brand-muted">
                {eyebrow}
              </p>
            )}
            <h1
              className={cn(
                "break-words text-2xl font-semibold leading-tight text-[var(--brand-ink)]",
                eyebrow && "mt-1",
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[var(--brand-muted)]">
                {subtitle}
              </p>
            )}
            {chips && chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <PageHeaderChip key={chip.label} {...chip} />
                ))}
              </div>
            )}
          </div>

          {(actions || showNotificationBell) && (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:gap-2.5 lg:w-auto lg:justify-end">
              {actions}
              {showNotificationBell && (
                <div className="admin-header-notifications hidden sm:block">
                  <NotificationBell
                    buttonClassName="h-10 w-10 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-mist)] hover:bg-[var(--brand-soft)]"
                    iconClassName="size-5 text-[var(--brand-muted)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function PageHeaderChip({
  label,
  tone = "default",
}: PageHeaderChip) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium",
        CHIP_STYLES[tone],
      )}
    >
      {label}
    </span>
  )
}
