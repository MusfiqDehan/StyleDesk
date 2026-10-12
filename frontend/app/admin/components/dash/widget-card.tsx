"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { DASH } from "./tokens"

interface WidgetCardProps {
  title: string
  icon?: LucideIcon
  action?: { label: string; href: string }
  headerExtra?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function WidgetCard({
  title,
  icon: Icon,
  action,
  headerExtra,
  children,
  className,
  noPadding = false,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        DASH.cardRadius,
        DASH.cardBg,
        "min-w-0 border",
        DASH.cardBorder,
        !noPadding && "p-4 sm:p-5",
        className,
      )}
    >
      <div className={cn("admin-chart-header", !noPadding ? "mb-4" : "mb-0 p-4 sm:p-5 pb-0")}>
        <h3 className="admin-chart-heading flex items-center gap-2 text-[15px] font-semibold text-[var(--brand-ink)]">
          {Icon && <Icon className="size-4 shrink-0 text-[#0076E9]" aria-hidden />}
          {title}
        </h3>
        <div className="admin-chart-actions flex flex-wrap items-center gap-2">
          {headerExtra}
          {action && (
            <Link
              href={action.href}
              className="text-xs font-medium text-[#0076E9] hover:text-[#0067cd] hover:underline"
            >
              {action.label}
            </Link>
          )}
        </div>
      </div>
      <div className={cn(noPadding && "px-4 pb-4 sm:px-5 sm:pb-5")}>{children}</div>
    </div>
  )
}
