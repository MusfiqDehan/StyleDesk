"use client"

import { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Download, TrendingUp, Users, Calendar, Calendar as CalendarIcon, Wallet } from "lucide-react"
import { getReports } from "@admin/api/reports/reports"
import { formatCurrency } from "@/lib/utils"
import { AdminPageHeader, AdminHeaderSecondaryButton, ADMIN_HEADER_ACTION_BASE } from "@admin/components/admin-page-header"
import { cn } from "@/lib/utils"
import {
  DashboardSection,
  KpiCard,
  KpiGrid,
  OverviewChartGrid,
  OverviewPage,
  OverviewPageLoader,
  PaymentMethodChart,
  TopServicesPieChart,
  AppointmentsBySourceChart,
  AppointmentsByStatusChart,
  StaffRevenueChart,
} from "@admin/components/dash"

interface ReportData {
  totalRevenue: number
  paidRevenue: number
  unpaidRevenue: number
  revenueByPaymentMethod: { Cash: number; bKash: number; Card: number }
  totalInvoices: number
  totalAppointments: number
  appointmentsByStatus: Record<string, number>
  appointmentsBySource: Record<string, number>
  newClients: number
  topServices: { name: string; count: number }[]
  topStaff: { name: string; revenue: number }[]
  onlineGrowth: number
  revenueTrend: { value: string; up: boolean; label: string }
  appointmentsTrend: { value: string; up: boolean; label: string }
  clientsTrend: { value: string; up: boolean; label: string }
  previousRevenue: number
  previousAppointments: number
  previousClients: number
}

const TIME_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Date" },
]

function getDateRange(filter: string): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = toStr(now)

  if (filter === "today") return { from: today, to: today }

  if (filter === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    return { from: toStr(d), to: today }
  }

  if (filter === "month") {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from, to: toStr(lastDay) }
  }

  if (filter === "6months") {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 6)
    return { from: toStr(d), to: today }
  }

  if (filter === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: today }
  }

  return { from: today, to: today }
}

export default function ReportsPage() {
  const [timeFilter, setTimeFilter] = useState("month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [reportsFromOpen, setReportsFromOpen] = useState(false)
  const [reportsToOpen, setReportsToOpen] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReports = useCallback(async (filter: string, from?: string, to?: string) => {
    const range = filter === "custom" && from && to
      ? { from, to }
      : getDateRange(filter)
    try {
      setLoading(true)
      const res = await getReports(range.from, range.to, true)
      setData(res)
    } catch (err) {
      console.error("Failed to fetch reports", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports("month")
  }, [fetchReports])

  const handleTimeFilterChange = (v: string) => {
    setTimeFilter(v)
    if (v === "custom") {
      setShowCustomDate(true)
    } else {
      fetchReports(v)
    }
  }

  const handleCustomApply = () => {
    setShowCustomDate(false)
    if (customFrom && customTo) fetchReports("custom", customFrom, customTo)
  }

  const handleExport = () => {
    if (!data) return
    const rows = [
      ["Total Revenue", data.totalRevenue],
      ["Paid Revenue", data.paidRevenue],
      ["Unpaid Revenue", data.unpaidRevenue],
      ["Total Appointments", data.totalAppointments],
      ["New Clients", data.newClients],
      ["Total Invoices", data.totalInvoices],
      [""],
      ["Payment Method", "Revenue"],
      ["Cash", data.revenueByPaymentMethod.Cash],
      ["bKash", data.revenueByPaymentMethod.bKash],
      ["Card", data.revenueByPaymentMethod.Card],
      [""],
      ["Service", "Bookings"],
      ...data.topServices.map((s) => [s.name, s.count]),
      [""],
      ["Staff", "Revenue"],
      ...data.topStaff.map((s) => [s.name, s.revenue]),
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-${timeFilter}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const paymentChartData = data
    ? Object.entries(data.revenueByPaymentMethod).map(([name, revenue]) => ({ name, revenue: Number(revenue) }))
    : []

  const statusOrder = ["Pending", "Confirmed", "Completed", "Checked In", "In Service"]
  const statusChartData = data
    ? statusOrder.map((name) => ({ name, count: data.appointmentsByStatus[name] || 0 }))
    : []

  const avgTicket = data && data.totalInvoices > 0
    ? Math.round(data.totalRevenue / data.totalInvoices)
    : 0

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Analytics"
        title="Report and Analysis"
        subtitle="Analyze revenue, appointments, and salon performance"
        actions={
          <>
            <Popover open={showCustomDate} onOpenChange={setShowCustomDate}>
              <PopoverTrigger asChild>
                <div className={cn(ADMIN_HEADER_ACTION_BASE, "cursor-pointer bg-[#f2f2f2] px-0 hover:bg-[#e8e8e8]")}>
                  <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                    <SelectTrigger className="h-10 w-[140px] border-0 bg-transparent shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem className="cursor-pointer" key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Popover open={reportsFromOpen} onOpenChange={setReportsFromOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal" accessAction="create">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className={customFrom ? "text-foreground" : "text-muted-foreground"}>
                            {customFrom ? format(new Date(`${customFrom}T00:00:00`), "PPP") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={customFrom ? new Date(`${customFrom}T00:00:00`) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return
                            setCustomFrom(format(selected, "yyyy-MM-dd"))
                            setReportsFromOpen(false)
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Popover open={reportsToOpen} onOpenChange={setReportsToOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal" accessAction="create">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className={customTo ? "text-foreground" : "text-muted-foreground"}>
                            {customTo ? format(new Date(`${customTo}T00:00:00`), "PPP") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={customTo ? new Date(`${customTo}T00:00:00`) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return
                            setCustomTo(format(selected, "yyyy-MM-dd"))
                            setReportsToOpen(false)
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button size="sm" className="w-full cursor-pointer" onClick={handleCustomApply}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <AdminHeaderSecondaryButton onClick={handleExport} disabled={!data} accessAction="export">
              <Download />
              Export
            </AdminHeaderSecondaryButton>
          </>
        }
      />

      {loading && <OverviewPageLoader label="Loading reports" />}

      {!loading && data && (
        <>
          <DashboardSection>
            <KpiGrid>
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(data.totalRevenue)}
                icon={Wallet}
                accent="blue"
                featured
                context={
                  <span>
                    {formatCurrency(data.paidRevenue)} collected
                    {data.unpaidRevenue > 0 ? ` · ${formatCurrency(data.unpaidRevenue)} due` : ""}
                  </span>
                }
                trend={data.revenueTrend.value}
                trendUp={data.revenueTrend.up}
                trendLabel={data.revenueTrend.label}
              />
              <KpiCard
                title="Appointments"
                value={data.totalAppointments}
                icon={Calendar}
                accent="emerald"
                context={`${data.totalInvoices} invoices (prev: ${data.previousAppointments})`}
                trend={data.appointmentsTrend.value}
                trendUp={data.appointmentsTrend.up}
                trendLabel={data.appointmentsTrend.label}
              />
              <KpiCard
                title="New Clients"
                value={data.newClients}
                icon={Users}
                accent="amber"
                context={`Prev period: ${data.previousClients}`}
                trend={data.clientsTrend.value}
                trendUp={data.clientsTrend.up}
                trendLabel={data.clientsTrend.label}
              />
              <KpiCard
                title="Avg. Revenue"
                value={formatCurrency(avgTicket)}
                icon={TrendingUp}
                accent="violet"
                context="Per completed service"
              />
            </KpiGrid>
          </DashboardSection>

          <DashboardSection title="Revenue & Services" description="Payment mix and top booked services">
            <OverviewChartGrid>
              <PaymentMethodChart data={paymentChartData} />
              <TopServicesPieChart services={data.topServices} />
            </OverviewChartGrid>
          </DashboardSection>

          <DashboardSection title="Appointments" description="Sources and status breakdown">
            <OverviewChartGrid>
              <AppointmentsBySourceChart
                data={["Walk-In", "Online", "Call"].map((name) => ({
                  name,
                  count: data.appointmentsBySource[name] || 0,
                }))}
                onlineGrowth={data.onlineGrowth}
              />
              <AppointmentsByStatusChart data={statusChartData} />
            </OverviewChartGrid>
          </DashboardSection>

          {data.topStaff.length > 0 && (
            <DashboardSection title="Team Performance" description="Top staff by revenue">
              <StaffRevenueChart data={data.topStaff} />
            </DashboardSection>
          )}
        </>
      )}
    </OverviewPage>
  )
}
