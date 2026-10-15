import { memo } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { DASH_CARD } from "@admin/components/dash"

interface StatCardProps {
  title: string
  value: string | number | React.ReactNode
  subtitle?: string | React.ReactNode
  icon: LucideIcon
  className?: string
  iconWrapperClassName?: string
  iconClassName?: string
  trend?: string
  trendLabel?: string
  trendUp?: boolean
  bottomContent?: React.ReactNode
}

export const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
  iconWrapperClassName,
  iconClassName,
  trend,
  trendLabel,
  trendUp,
  bottomContent,
}: StatCardProps) {
  return (
    <div className={cn(
      DASH_CARD,
      "flex h-full min-w-0 flex-col gap-4 px-5 py-4",
      className
    )}>
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium leading-snug text-brand-muted">{title}</h3>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-brand-soft text-brand-primary", iconWrapperClassName)}>
          <Icon className={cn("h-5 w-5", iconClassName)} />
        </div>
      </div>

      <div className="flex flex-1 items-center">
        <div className="break-words text-[28px] font-semibold leading-tight tabular-nums text-brand-ink">
          {value}
        </div>
      </div>

      <div className="pt-3">
        {subtitle && (
          <div className="mb-1 text-[12px] font-normal text-brand-muted">
            {subtitle}
          </div>
        )}
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-[13px] font-medium leading-none">
            <span className={cn(
              trendUp ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend} {trendUp ? "increase" : "lower"} {trendLabel}
            </span>
            {trendUp ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 rotate-[135deg] text-rose-500" />
            )}
          </div>
        )}
        {bottomContent}
      </div>
    </div>
  )
})
