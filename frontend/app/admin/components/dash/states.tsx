import { AlertCircle, BarChart3, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { DASH } from "./tokens"

export function DashboardErrorBanner({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

export function DashboardEmptyState({
  title = "No data yet",
  description,
  icon: Icon = Inbox,
  className,
}: {
  title?: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-slate-100">
        <Icon className="size-5 text-slate-400" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-slate-400">{description}</p>
      )}
    </div>
  )
}

export function DashboardChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border",
        DASH.cardBorder,
        DASH.cardBg,
        "p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-slate-100" />
        <div className="h-8 w-24 rounded-lg bg-slate-100" />
      </div>
      <div className="flex h-56 items-end gap-2 px-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-slate-100"
            style={{ height: `${30 + (i % 4) * 15}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className={cn("rounded-xl border p-6", DASH.cardBorder, DASH.cardBg)}>
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="mt-2 h-8 w-56 rounded-lg bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn("h-32 rounded-xl border", DASH.cardBorder, DASH.cardBg)}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardChartSkeleton />
        <DashboardChartSkeleton />
      </div>
    </div>
  )
}

export function DashboardSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div
        className="size-9 animate-spin rounded-full border-2 border-[#0076E9]/20 border-t-[#0076E9]"
        role="status"
        aria-label={label}
      />
      <p className="text-sm text-slate-500">{label}…</p>
    </div>
  )
}
