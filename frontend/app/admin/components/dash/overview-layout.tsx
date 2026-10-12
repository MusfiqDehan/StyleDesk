import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DashPage } from "./page-shell"
import { DashboardSection } from "./dashboard-shell"
import { DashboardSpinner } from "./states"

/** Standard overview page canvas — single padding source for role dashboards. */
export function OverviewPage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <DashPage className={className}>{children}</DashPage>
}

export { DashboardSection }

/** KPI row wrapper — sits directly under PageHeader. */
export function OverviewKpiSection({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <DashboardSection className={className}>{children}</DashboardSection>
}

type GridColumns = 2 | 3 | "split" | "wide-narrow"

const GRID_CLASS: Record<GridColumns, string> = {
  2: "grid grid-cols-1 gap-5 lg:grid-cols-2",
  3: "grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr_1fr]",
  split: "grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]",
  "wide-narrow": "grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]",
}

/** Primary chart row (typically 2-up or wide + narrow). */
export function OverviewChartGrid({
  children,
  className,
  columns = 2,
}: {
  children: ReactNode
  className?: string
  columns?: GridColumns
}) {
  return <div className={cn(GRID_CLASS[columns], className)}>{children}</div>
}

/** Secondary widgets row (schedule, top services, attendance, etc.). */
export function OverviewWidgetGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(GRID_CLASS[3], className)}>{children}</div>
}

/** Main content + sidebar (appointments queue, focus panels). */
export function OverviewSplitGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(GRID_CLASS.split, className)}>{children}</div>
}

/** Compact insight card for header actions (e.g. next appointment). */
export function OverviewHeaderInsight({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-[240px] rounded-xl border border-[var(--brand-line)] bg-[var(--brand-mist)] px-4 py-3",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
        {label}
      </p>
      <div className="mt-1 text-sm text-[var(--brand-ink)]">{children}</div>
    </div>
  )
}

export function OverviewPageLoader({ label = "Loading" }: { label?: string }) {
  return <DashboardSpinner label={label} />
}
