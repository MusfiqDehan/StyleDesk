"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DASH } from "./tokens"
import { DashboardChartSkeleton } from "./states"

interface ChartCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
  refreshing?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
  contentClassName?: string
  height?: number | string
}

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  loading = false,
  refreshing = false,
  error,
  onRetry,
  className,
  contentClassName,
  height = 260,
}: ChartCardProps) {
  if (loading) {
    return <DashboardChartSkeleton className={className} />
  }

  return (
    <div
      className={cn(
        DASH.cardRadius,
        DASH.cardBg,
        "min-w-0 border",
        DASH.cardBorder,
        "p-4 sm:p-5",
        className,
      )}
    >
      <div className="admin-chart-header">
        <div className="admin-chart-heading">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--brand-ink)]">
            {Icon && <Icon className="size-4 shrink-0 text-[#0076E9]" aria-hidden />}
            {title}
            {refreshing && (
              <span
                className="inline-block size-3.5 animate-spin rounded-full border-2 border-[#0076E9]/25 border-t-[#0076E9]"
                aria-label="Refreshing chart"
              />
            )}
          </h3>
          {error ? (
            <p className="mt-0.5 text-xs text-rose-600">
              {error}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ml-2 font-medium text-[#0076E9] hover:underline"
                >
                  Retry
                </button>
              )}
            </p>
          ) : subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--brand-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {actions && <div className="admin-chart-actions">{actions}</div>}
      </div>
      <div
        className={cn(
          "relative w-full",
          refreshing && "opacity-60 transition-opacity",
          contentClassName,
        )}
        style={{ height: typeof height === "number" ? height : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
