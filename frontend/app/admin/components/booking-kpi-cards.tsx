"use client"

import { CalendarDays, Clock3, CircleCheck, Ban } from "lucide-react"
import { DashKpiCard, DashKpiGrid, type DashKpiTone } from "@admin/components/dash"

/** YYYY-MM-DD in Asia/Dhaka (salon business calendar). */
export function businessTodayStr(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Whether an appointment date falls inside the bookings time-period filter. */
export function appointmentMatchesTimeFilter(
  date: string,
  timeFilter: string,
  customDateFrom = "",
  customDateTo = "",
): boolean {
  if (timeFilter === "All Time") return true

  const aptDateStr = (date || "").slice(0, 10)
  if (!aptDateStr) return false

  const todayStr = businessTodayStr()
  const aptDate = new Date(`${aptDateStr}T12:00:00+06:00`)
  const today = new Date(`${todayStr}T12:00:00+06:00`)

  switch (timeFilter) {
    case "Custom Date":
      if (!customDateFrom && !customDateTo) return true
      if (customDateFrom && aptDateStr < customDateFrom) return false
      if (customDateTo && aptDateStr > customDateTo) return false
      return true
    case "Today":
      return aptDateStr === todayStr
    case "This Week": {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return aptDate >= weekStart && aptDate <= weekEnd
    }
    case "This Month":
      return (
        aptDate.getMonth() === today.getMonth() &&
        aptDate.getFullYear() === today.getFullYear()
      )
    case "Last 6 Months": {
      const sixMonthsAgo = new Date(today)
      sixMonthsAgo.setMonth(today.getMonth() - 6)
      return aptDate >= sixMonthsAgo
    }
    case "This Year":
      return aptDate.getFullYear() === today.getFullYear()
    default:
      return true
  }
}

function periodLabel(timeFilter: string): string {
  switch (timeFilter) {
    case "Today":
      return "Today"
    case "This Week":
      return "This week"
    case "This Month":
      return "This month"
    case "Last 6 Months":
      return "Last 6 months"
    case "This Year":
      return "This year"
    case "Custom Date":
      return "Selected range"
    default:
      return "All time"
  }
}

export type BookingKpiKey = "total" | "pending" | "confirmed" | "cancelled"

export interface BookingKpiItem {
  date: string
  status: string
}

interface BookingKpiCardsProps {
  appointments: BookingKpiItem[]
  timeFilter?: string
  loading?: boolean
  active?: BookingKpiKey | null
  onSelect?: (key: BookingKpiKey) => void
  className?: string
}

export function BookingKpiCards({
  appointments,
  timeFilter = "All Time",
  loading = false,
  active = null,
  onSelect,
  className,
}: BookingKpiCardsProps) {
  const period = periodLabel(timeFilter)
  const totalCount = appointments.length
  const pendingCount = appointments.filter((a) => a.status === "Pending").length
  const confirmedCount = appointments.filter((a) => a.status === "Confirmed").length
  const cancelledCount = appointments.filter((a) => a.status === "Cancelled").length

  const cards: Array<{
    key: BookingKpiKey
    title: string
    value: number
    subtitle: string
    icon: typeof CalendarDays
    tone: DashKpiTone
  }> = [
    {
      key: "total",
      title: timeFilter === "Today" ? "Today's Bookings" : "Bookings",
      value: totalCount,
      subtitle: period,
      icon: CalendarDays,
      tone: "brand",
    },
    {
      key: "pending",
      title: "Pending Bookings",
      value: pendingCount,
      subtitle: period,
      icon: Clock3,
      tone: "warning",
    },
    {
      key: "confirmed",
      title: "Confirmed",
      value: confirmedCount,
      subtitle: period,
      icon: CircleCheck,
      tone: "success",
    },
    {
      key: "cancelled",
      title: "Cancelled",
      value: cancelledCount,
      subtitle: period,
      icon: Ban,
      tone: "danger",
    },
  ]

  return (
    <DashKpiGrid className={className}>
      {cards.map((card) => (
        <DashKpiCard
          key={card.key}
          title={card.title}
          value={loading ? "—" : card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          tone={card.tone}
          highlighted={active === card.key}
          onClick={onSelect ? () => onSelect(card.key) : undefined}
          disabled={!onSelect || loading}
        />
      ))}
    </DashKpiGrid>
  )
}
