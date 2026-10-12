import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DASH } from "./tokens"

export interface QuickLinkItem {
  href: string
  label: string
  icon: React.ReactNode
  description?: string
}

export function QuickLinksGrid({
  items,
  className,
  columns = 3,
}: {
  items: QuickLinkItem[]
  className?: string
  columns?: 2 | 3 | 4
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "group flex items-center gap-3 rounded-xl border p-4 transition-all",
            DASH.cardBorder,
            DASH.cardBg,
            "hover:border-[#0076E9]/30 hover:shadow-md hover:shadow-[#0076E9]/5",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0076E9]/10 text-[#0076E9]">
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--brand-ink)]">{item.label}</p>
            {item.description && (
              <p className="mt-0.5 truncate text-xs text-[var(--brand-muted)]">{item.description}</p>
            )}
          </div>
          <ArrowUpRight
            className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0076E9]"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  )
}

export function QuickLinksList({
  items,
  className,
}: {
  items: QuickLinkItem[]
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-line)] px-3 py-2.5 text-sm text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-mist)]"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-[var(--brand-muted)]">{item.icon}</span>
            {item.label}
          </span>
          <ArrowUpRight className="size-3.5 text-slate-400" aria-hidden />
        </Link>
      ))}
    </div>
  )
}
