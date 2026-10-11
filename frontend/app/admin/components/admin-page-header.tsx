"use client"

import type { ReactNode } from "react"
import {
  PageHeader,
  type PageHeaderBreadcrumb,
  type PageHeaderChip,
} from "@admin/components/dash/page-header"

export {
  PageHeaderSecondaryButton,
  PageHeaderPrimaryButton,
  PageHeaderDangerButton,
  PageHeaderYearSwitch,
  AdminHeaderSecondaryButton,
  AdminHeaderPrimaryButton,
  AdminHeaderDangerButton,
  AdminHeaderYearSwitch,
  PAGE_HEADER_ACTION_BASE,
  ADMIN_HEADER_ACTION_BASE,
} from "@admin/components/dash/page-header-actions"

/** Date label used on dashboard subtitles. */
export function adminPageTodayLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

interface AdminPageHeaderProps {
  title: string
  subtitle: string
  eyebrow?: string
  breadcrumbs?: PageHeaderBreadcrumb[]
  chips?: PageHeaderChip[]
  actions?: ReactNode
  showNotificationBell?: boolean
  className?: string
}

/**
 * Standard admin page title card — delegates to shared PageHeader.
 * Used across all dashboard routes and admin CRUD pages.
 */
export function AdminPageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  chips,
  actions,
  showNotificationBell = false,
  className,
}: AdminPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
      chips={chips}
      actions={actions}
      showNotificationBell={showNotificationBell}
      className={className}
    />
  )
}
