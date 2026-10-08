"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  Package,
  Users,
} from "lucide-react"
import { useAuth } from "@admin/hooks/use-auth"
import { hasPermission } from "@admin/lib/auth-utils"
import { getDashboardStats } from "@admin/api/dashboard/dashboard"
import { RevenueChart, AppointmentChart } from "@admin/components/dashboard-charts"
import { AdminPageHeader } from "@admin/components/admin-page-header"
import { formatMoney } from "@/lib/utils"
import {
  DashKpiCard,
  DashKpiGrid,
  DashboardSection,
  OverviewChartGrid,
  OverviewPage,
  OverviewPageLoader,
  QuickLinksGrid,
} from "@admin/components/dash"

export default function ManagerDashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !hasPermission(user, "manager-dashboard")) {
      router.replace("/admin")
    }
  }, [loading, user, router])

  useEffect(() => {
    const load = async () => {
      try {
        setStatsLoading(true)
        const data = await getDashboardStats(true)
        setStats(data)
      } catch {
        setStats(null)
      } finally {
        setStatsLoading(false)
      }
    }

    if (!loading && user?.role === "storeManager") {
      void load()
    }
  }, [loading, user?.role])

  if (loading || !hasPermission(user, "manager-dashboard")) {
    return (
      <OverviewPage>
        <OverviewPageLoader label="Loading manager dashboard" />
      </OverviewPage>
    )
  }

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Management"
        title="Manager Dashboard"
        subtitle="Weekly revenue, operations, and team overview"
      />

      <DashboardSection>
        <DashKpiGrid>
          <DashKpiCard
            title="Revenue (Week)"
            value={statsLoading ? "—" : `TK. ${formatMoney(stats?.weeklyRevenue ?? 0)}`}
            subtitle={`Last week TK. ${formatMoney(stats?.lastWeekRevenue ?? 0)}`}
            icon={DollarSign}
            highlighted
          />
          <DashKpiCard
            title="Today Appointments"
            value={statsLoading ? "—" : String(stats?.todaysAppointmentsCount ?? 0)}
            subtitle={`Online ${stats?.onlineBookingsToday ?? 0} · Walk-in ${stats?.walkInsToday ?? 0}`}
            icon={CalendarDays}
          />
          <DashKpiCard
            title="New Clients (Week)"
            value={statsLoading ? "—" : String(stats?.totalClientsThisWeek ?? 0)}
            subtitle={`${stats?.totalClients ?? 0} total clients`}
            icon={Users}
          />
          <DashKpiCard
            title="Low Stock Items"
            value={statsLoading ? "—" : String(stats?.lowStockItemsCount ?? 0)}
            subtitle={stats?.lowStockItemsCount ? "Needs attention" : "Inventory healthy"}
            icon={Package}
            tone="warning"
          />
        </DashKpiGrid>
      </DashboardSection>

      <DashboardSection title="Trends" description="Live revenue and booking charts">
        <OverviewChartGrid>
          <RevenueChart />
          <AppointmentChart />
        </OverviewChartGrid>
      </DashboardSection>

      <DashboardSection title="Quick Actions">
        <QuickLinksGrid
          items={[
            {
              href: "/admin/appointments",
              label: "Appointments",
              icon: <CalendarDays className="size-4" />,
              description: "Manage daily schedule",
            },
            {
              href: "/admin/reports",
              label: "Reports & Analysis",
              icon: <BarChart3 className="size-4" />,
              description: "Revenue and performance",
            },
            {
              href: "/admin/manage-payrolls",
              label: "Manage Payrolls",
              icon: <Users className="size-4" />,
              description: "Staff compensation",
            },
          ]}
        />
      </DashboardSection>
    </OverviewPage>
  )
}
