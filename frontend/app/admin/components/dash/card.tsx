import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  DASH_CARD,
  DASH_CARD_PADDED,
  DASH_LINK,
  DASH_PANEL_ICON,
  DASH_PANEL_TITLE,
} from "./styles"

interface DashCardProps {
  children: ReactNode
  className?: string
  padded?: boolean
}

/** White rounded card used across dashboard widgets, tables, and forms. */
export function DashCard({ children, className, padded = true }: DashCardProps) {
  return (
    <div className={cn(padded ? DASH_CARD_PADDED : DASH_CARD, className)}>
      {children}
    </div>
  )
}

interface DashPanelHeaderProps {
  title: string
  icon?: LucideIcon
  actionHref?: string
  actionLabel?: string
  extra?: ReactNode
  className?: string
}

/** Title row shared by charts, tables, and sidebar-style widgets. */
export function DashPanelHeader({
  title,
  icon: Icon,
  actionHref,
  actionLabel,
  extra,
  className,
}: DashPanelHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-center justify-between gap-3", className)}>
      <h3 className={DASH_PANEL_TITLE}>
        {Icon ? <Icon className={DASH_PANEL_ICON} /> : null}
        {title}
      </h3>
      {extra}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={DASH_LINK}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

interface DashQuickLinkProps {
  href: string
  label: string
  icon: LucideIcon
}

export function DashQuickLink({ href, label, icon: Icon }: DashQuickLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        DASH_CARD,
        "flex items-center gap-2 p-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-mist",
      )}
    >
      <Icon className="size-4 text-brand-primary" />
      {label}
    </Link>
  )
}
