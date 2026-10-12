"use client"

import { useCallback, useEffect, useState } from "react"
import { BookingChannelInsights } from "./dash/booking-channel-insights"
import { RevenueChart, AppointmentChart } from "@admin/components/dashboard-charts"
import {
  TodaysAppointments,
  TopServices,
} from "@admin/components/dashboard-widgets"
import {
  Calendar,
  Wallet,
  Users,
  AlertTriangle,
  Plus,
} from "lucide-react"
import { getTodayAttendance, type AttendanceRecord } from "@admin/api/attendance/attendance"
import { getDashboardStats } from "@admin/api/dashboard/dashboard"
import { useAuth } from "@admin/hooks/use-auth"
import { CACHE, markStale } from "@admin/lib/cache"
import { formatMoney } from "@/lib/utils"
import { useBiometricSocket, type AttendanceUpdatedPayload } from "@/hooks/use-biometric-socket"
import Link from "next/link"
import {
  DashboardSection,
  DashboardErrorBanner,
  EmployeeOnDuty,
  KpiCard,
  KpiGrid,
  OverviewChartGrid,
  OverviewPage,
  OverviewPageLoader,
  OverviewWidgetGrid,
} from "@admin/components/dash"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(true)

  const todayDate = new Date().toISOString().split("T")[0]

  const loadAttendance = useCallback(async () => {
    try {
      const recs = await getTodayAttendance()
      setAttendanceRecords(recs)
    } catch {
      // silently ignore — the count cards fall back to 0
    } finally {
      setAttendanceLoading(false)
    }
  }, [])

  const handleAttendanceUpdated = useCallback((payload: AttendanceUpdatedPayload) => {
    if (payload.attendanceDates.includes(todayDate)) {
      void loadAttendance()
    }
  }, [loadAttendance, todayDate])

  useBiometricSocket({ onAttendanceUpdated: handleAttendanceUpdated })

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const loadStats = useCallback(async (bypassCache = false) => {
    if (bypassCache) markStale(CACHE.DASHBOARD)
    try {
      const data = await getDashboardStats(true)
      setStats(data)
      setError(null)
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError(err.message || "Failed to load dashboard data")
      } else {
        setError("Authentication failed")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      void loadStats()
      void loadAttendance()
    }
  }, [authLoading, user, loadStats, loadAttendance])

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => { if (document.visibilityState !== "hidden") void loadStats(true) }, 60_000)
    return () => clearInterval(id)
  }, [user, loadStats])

  const getTrend = (current: any, previous: any) => {
    const cur = parseFloat(String(current || 0))
    const prev = parseFloat(String(previous || 0))

    if (!prev || prev === 0) {
      return cur > 0 ? { trend: "100%", trendUp: true } : { trend: "0%", trendUp: true }
    }

    const diff = cur - prev
    const percent = Math.abs((diff / prev) * 100).toFixed(0)
    return {
      trend: `${percent}%`,
      trendUp: diff >= 0,
    }
  }

  const revenueTrend = getTrend(stats?.weeklyRevenue, stats?.lastWeekRevenue)
  const appointmentTrend = getTrend(stats?.todaysAppointmentsCount, stats?.yesterdaysAppointmentsCount)
  const totalClients = stats?.totalClients ?? 0
  const clientTrend = getTrend(stats?.totalClientsThisWeek, stats?.totalClientsLastWeek)

  const onlineCount = stats?.onlineBookingsToday ?? 0
  const walkinCount = stats?.walkInsToday ?? 0
  const callCount = stats?.callBookingsToday ?? 0

  if (authLoading) {
    return (
      <OverviewPage>
        <OverviewPageLoader label="Loading dashboard" />
      </OverviewPage>
    )
  }

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle={`${today} — Here's your salon today`}
        showNotificationBell
        actions={
          <AdminHeaderPrimaryButton asChild>
            <Link href="/admin/pos">
              <Plus />
              New Appointment
            </Link>
          </AdminHeaderPrimaryButton>
        }
      />

      {error && <DashboardErrorBanner message={`Failed to load dashboard data: ${error}`} />}

      <DashboardSection>
        <KpiGrid>
          <KpiCard
            title="Revenue This Week"
            value={loading || !stats ? "—" : `TK. ${formatMoney(stats.weeklyRevenue ?? 0)}`}
            icon={Wallet}
            accent="blue"
            featured
            loading={loading}
            context={`Last week TK. ${formatMoney(stats?.lastWeekRevenue ?? 0)}`}
            trend={revenueTrend.trend}
            trendLabel="from last week"
            trendUp={revenueTrend.trendUp}
          />
          <KpiCard
            title="Today's Appointments"
            value={loading || !stats ? "—" : (stats.todaysAppointmentsCount ?? 0)}
            icon={Calendar}
            accent="emerald"
            loading={loading}
            context={
              <span className="flex flex-wrap gap-x-2.5 gap-y-1">
                <span>Online: {onlineCount}</span>
                <span>Walk-in: {walkinCount}</span>
                <span>Call: {callCount}</span>
              </span>
            }
            trend={appointmentTrend.trend}
            trendLabel="than yesterday"
            trendUp={appointmentTrend.trendUp}
          />
          <KpiCard
            title="Total Clients"
            value={loading || !stats ? "—" : totalClients}
            icon={Users}
            accent="amber"
            loading={loading}
            context={`New this week: ${stats?.totalClientsThisWeek ?? 0}`}
            trend={clientTrend.trend}
            trendLabel="new vs last week"
            trendUp={clientTrend.trendUp}
          />
          <KpiCard
            title="Stock Alerts"
            value={loading || !stats ? "—" : (stats.lowStockItemsCount ?? 0)}
            icon={AlertTriangle}
            accent="violet"
            loading={loading}
            context={
              stats?.lowStockItemsCount
                ? `${stats.lowStockItemsCount} items low in stock`
                : "Inventory is healthy"
            }
            bottomContent={
              <div className="flex flex-wrap gap-2 pt-1">
                {(stats?.lowStockItems || []).slice(0, 2).map((item: any, i: number) => (
                  <div key={item.id || i} className="flex items-center gap-1.5 text-[11px] text-[#5f6368]">
                    <span className={`size-2 rounded-sm ${i === 0 ? "bg-amber-400" : "bg-rose-500"}`} />
                    {item.name} ({item.stockQty} left)
                  </div>
                ))}
              </div>
            }
          />
        </KpiGrid>
      </DashboardSection>

      <DashboardSection title="Performance" description="Revenue and booking trends from live chart APIs">
        <OverviewChartGrid columns="wide-narrow">
          <RevenueChart />
          <AppointmentChart />
        </OverviewChartGrid>
      </DashboardSection>

      <DashboardSection title="Booking insights" description="Explore booking channels and service popularity">
        <BookingChannelInsights stats={stats} />
      </DashboardSection>

      <DashboardSection title="Today's Operations" description="Schedule, services, and attendance">
        <OverviewWidgetGrid>
          <TodaysAppointments appointments={stats?.todaysAppointments ?? []} />
          <TopServices />
          <EmployeeOnDuty
            records={attendanceRecords}
            loading={attendanceLoading}
            activeEmployeesCount={stats?.activeEmployeesCount ?? 0}
          />
        </OverviewWidgetGrid>
      </DashboardSection>
    </OverviewPage>
  )
}
