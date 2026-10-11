"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { adminPageTodayLabel } from "@admin/components/admin-page-header"
import { PageHeaderPrimaryButton } from "./page-header-actions"
import { PageHeader, type PageHeaderProps } from "./page-header"

interface DashboardHeaderProps extends Omit<PageHeaderProps, "eyebrow" | "showNotificationBell"> {
  showNewAppointment?: boolean
  showNotifications?: boolean
}

export function DashboardHeader({
  title,
  subtitle,
  showNewAppointment = true,
  showNotifications = true,
  actions,
  ...rest
}: DashboardHeaderProps) {
  const defaultSubtitle = `${adminPageTodayLabel()} — Here's your salon today`

  return (
    <PageHeader
      eyebrow="Overview"
      title={title}
      subtitle={subtitle ?? defaultSubtitle}
      showNotificationBell={showNotifications}
      actions={
        <>
          {actions}
          {showNewAppointment && (
            <PageHeaderPrimaryButton asChild>
              <Link href="/admin/pos">
                <Plus aria-hidden />
                New Appointment
              </Link>
            </PageHeaderPrimaryButton>
          )}
        </>
      }
      {...rest}
    />
  )
}
