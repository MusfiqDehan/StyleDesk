"use client"

import { memo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DASH_CARD } from "./styles"
import { DASH } from "./tokens"

export type DashKpiTone = "brand" | "success" | "warning" | "danger" | "neutral"

const TONE_ICON: Record<DashKpiTone, string> = {
  brand: "bg-brand-soft text-brand-text",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
  neutral: "bg-brand-soft text-brand-text",
}

interface DashKpiCardProps {
  title: string
  value: ReactNode
  subtitle?: ReactNode
  icon: LucideIcon
  tone?: DashKpiTone
  highlighted?: boolean
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
  children?: ReactNode
}

/** Metric tile used on overview, bookings, invoices, finance, and role dashboards. */
export function DashKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "brand",
  highlighted = false,
  selected,
  onClick,
  disabled,
  className,
  children,
}: DashKpiCardProps) {
  const classes = cn(
    DASH_CARD,
    "flex flex-col gap-5 py-3.5 pl-4 pr-3 text-left transition-colors",
    highlighted && "border-l-2 border-t-2 border-brand-primary ring-2 ring-brand-primary/15",
    onClick && "cursor-pointer hover:border-brand-primary",
    disabled && "opacity-70",
    className,
  )

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p data-slot="kpi-title" className="text-sm font-medium text-brand-muted">{title}</p>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            TONE_ICON[tone],
          )}
        >
          <Icon className="size-[22px]" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div data-slot="kpi-value" className="break-words text-[28px] font-semibold leading-tight tabular-nums text-brand-ink">
          {value}
        </div>
        {subtitle ? <div data-slot="kpi-subtitle" className="text-sm text-brand-muted">{subtitle}</div> : null}
        {children}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button data-slot="kpi-card" type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={classes}>
        {body}
      </button>
    )
  }

  return <div data-slot="kpi-card" className={classes}>{body}</div>
}

interface DashKpiGridProps {
  children: ReactNode
  className?: string
}

export function DashKpiGrid({ children, className }: DashKpiGridProps) {
  return (
    <div
      data-slot="kpi-grid"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

export type KpiAccent = "blue" | "emerald" | "amber" | "violet" | "rose" | "sky" | "slate"

const ACCENT_STYLES: Record<
  KpiAccent,
  { border: string; iconBg: string; iconText: string; trendUp: string; trendDown: string }
> = {
  blue: {
    border: "border-t-[#0076E9]",
    iconBg: "bg-[#0076E9]/10",
    iconText: "text-[#0076E9]",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  emerald: {
    border: "border-t-emerald-500",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  amber: {
    border: "border-t-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  violet: {
    border: "border-t-violet-500",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  rose: {
    border: "border-t-rose-500",
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  sky: {
    border: "border-t-sky-500",
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
  slate: {
    border: "border-t-slate-400",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    trendUp: "text-emerald-600",
    trendDown: "text-rose-500",
  },
}

export interface KpiCardProps {
  title: string
  value: string | number | React.ReactNode
  context?: React.ReactNode
  icon: LucideIcon
  accent?: KpiAccent
  trend?: string
  trendLabel?: string
  trendUp?: boolean
  featured?: boolean
  loading?: boolean
  onClick?: () => void
  active?: boolean
  bottomContent?: React.ReactNode
  className?: string
  iconWrapperClassName?: string
}

/** Interactive KPI tile with trends — used on main overview dashboards. */
export const KpiCard = memo(function KpiCard({
  title,
  value,
  context,
  icon: Icon,
  accent = "blue",
  trend,
  trendLabel,
  trendUp = true,
  featured = false,
  loading = false,
  onClick,
  active = false,
  bottomContent,
  className,
  iconWrapperClassName,
}: KpiCardProps) {
  const styles = ACCENT_STYLES[accent]
  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? "button" : undefined}
      data-slot="kpi-card"
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "group relative flex flex-col overflow-hidden",
        DASH.cardRadius,
        DASH.cardBg,
        "border",
        DASH.cardBorder,
        "p-4 sm:p-5 transition-all duration-200",
        interactive && "cursor-pointer hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary",
        featured && "ring-1 ring-[#0076E9]/20",
        active && "ring-2 ring-[#0076E9]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p data-slot="kpi-title" className="text-sm font-medium text-[var(--brand-muted)] leading-tight">{title}</p>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            styles.iconBg,
            styles.iconText,
            iconWrapperClassName,
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </div>
      </div>

      <div className="mt-3 min-h-[2.5rem]">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
        ) : (
          <p data-slot="kpi-value" className="break-words text-[28px] font-semibold tabular-nums text-[var(--brand-ink)] leading-tight">
            {value}
          </p>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {context && !loading && (
          <div className="text-xs text-[var(--brand-muted)] leading-relaxed">{context}</div>
        )}
        {trend && !loading && (
          <div className="flex flex-wrap items-center gap-1 text-xs font-medium">
            <span className={trendUp ? styles.trendUp : styles.trendDown}>{trend}</span>
            <span className="text-[#94a3b8]">
              {trendUp ? "up" : "down"} {trendLabel}
            </span>
            {trendUp ? (
              <TrendingUp className={cn("size-3.5", styles.trendUp)} aria-hidden />
            ) : (
              <TrendingDown className={cn("size-3.5", styles.trendDown)} aria-hidden />
            )}
          </div>
        )}
        {bottomContent}
      </div>
    </div>
  )
})

export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="kpi-grid" className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  )
}
