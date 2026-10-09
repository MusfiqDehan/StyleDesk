"use client"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Download, User, Calendar, Calendar as CalendarIcon, Receipt, TrendingUp } from "lucide-react"
import { getStaffReports } from "@admin/api/staff-reports/staff-reports"
import { cn, formatCurrency } from "@/lib/utils"
import { AdminPageHeader, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header"
import {
  DashboardSection,
  KpiCard,
  KpiGrid,
  OverviewPage,
  OverviewPageLoader,
} from "@admin/components/dash"
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
} from "@admin/lib/table-styles"

interface StaffPerformance {
  id: string
  name: string
  role: string
  status: string
  appointments: number
  revenue: number
  efficiency: number
}

interface StaffReportData {
  staff: StaffPerformance[]
  totalStaff: number
  totalAppointments: number
  totalRevenue: number
}

const TIME_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Date" },
]
const PAGE_SIZE = 10

function getDateRange(filter: string): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = toStr(now)

  if (filter === "today") return { from: today, to: today }
  if (filter === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: toStr(d), to: today }
  }
  if (filter === "month") {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from, to: toStr(lastDay) }
  }
  if (filter === "6months") {
    const d = new Date(now); d.setMonth(d.getMonth() - 6)
    return { from: toStr(d), to: today }
  }
  if (filter === "year") return { from: `${now.getFullYear()}-01-01`, to: today }
  return { from: today, to: today }
}

export default function StaffReportsPage() {
  const [timeFilter, setTimeFilter] = useState("month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [staffFromOpen, setStaffFromOpen] = useState(false)
  const [staffToOpen, setStaffToOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [data, setData] = useState<StaffReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReports = useCallback(async (filter: string, from?: string, to?: string) => {
    const range = filter === "custom" && from && to ? { from, to } : getDateRange(filter)
    try {
      setLoading(true)
      const res = await getStaffReports(range.from, range.to, true)
      setData(res)
    } catch (err) {
      console.error("Failed to fetch staff reports", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports("month")
  }, [fetchReports])

  const handleTimeFilterChange = (v: string) => {
    setTimeFilter(v)
    if (v === "custom") { setShowCustomDate(true) } else { fetchReports(v) }
  }

  const handleCustomApply = () => {
    setShowCustomDate(false)
    if (customFrom && customTo) fetchReports("custom", customFrom, customTo)
  }

  const handleExport = () => {
    if (!data) return
    const rows = data.staff.map(s => [s.name, s.role, s.status, s.appointments, s.revenue, s.efficiency + "%"])
    const csv = [
      ["Staff Performance Report"],
      [""],
      ["Name", "Role", "Status", "Appointments", "Revenue", "Efficiency"],
      ...rows,
      [""],
      ["Total Staff", data.totalStaff],
      ["Total Appointments", data.totalAppointments],
      ["Total Revenue", data.totalRevenue],
      ["Avg Revenue per Staff", data.totalStaff > 0 ? Math.round(data.totalRevenue / data.totalStaff) : 0],
    ].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staff-report-${timeFilter}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const topByAppointments = data?.staff.reduce((top, s) => s.appointments > (top?.appointments ?? -1) ? s : top, null as StaffPerformance | null)
  const topByRevenue = data?.staff.reduce((top, s) => s.revenue > (top?.revenue ?? -1) ? s : top, null as StaffPerformance | null)
  const avgRevenuePerStaff = data && data.totalStaff > 0 ? data.totalRevenue / data.totalStaff : 0
  const avgAppointmentsPerStaff = data && data.totalStaff > 0 ? data.totalAppointments / data.totalStaff : 0
  const staffRows = data?.staff ?? []
  const totalPages = Math.max(1, Math.ceil(staffRows.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(staffRows, row => String(row.id))
  const paginatedStaff = cursorTable.data

  useEffect(() => {
    setCurrentPage(1)
  }, [timeFilter, customFrom, customTo, data?.staff.length])

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Team Analytics"
        title="Staff Reports"
        subtitle="Review staff performance and productivity metrics"
        actions={
          <AdminHeaderSecondaryButton onClick={handleExport} disabled={!data} accessAction="export">
            <Download />
            Export
          </AdminHeaderSecondaryButton>
        }
      />

      {loading && <OverviewPageLoader label="Loading staff reports" />}

      {!loading && data && (
        <>
          <DashboardSection title="Summary" description="Aggregate performance for the selected period">
            <KpiGrid>
              <KpiCard
                title="Total Staff"
                value={data.totalStaff}
                icon={User}
                accent="blue"
                featured
              />
              <KpiCard
                title="Total Appointments"
                value={data.totalAppointments}
                icon={Calendar}
                accent="emerald"
                context={
                  topByAppointments
                    ? `Top: ${topByAppointments.name} (${topByAppointments.appointments})`
                    : undefined
                }
              />
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(data.totalRevenue)}
                icon={Receipt}
                accent="amber"
                context={
                  topByRevenue ? `Top: ${topByRevenue.name}` : undefined
                }
              />
              <KpiCard
                title="Avg. Revenue / Staff"
                value={formatCurrency(avgRevenuePerStaff)}
                icon={TrendingUp}
                accent="violet"
                context={`${avgAppointmentsPerStaff.toFixed(1)} appointments per staff`}
              />
            </KpiGrid>
          </DashboardSection>

          <DashboardSection title="Staff Performance" description="Individual metrics for the selected period">
          {/* Performance Table */}
          <div className={cn(TABLE_CARD_CLASS, "mb-6")}>
            <div className="border-b border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Popover open={showCustomDate} onOpenChange={setShowCustomDate}>
                  <PopoverTrigger asChild>
                    <div>
                      <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                        <SelectTrigger className={FILTER_TRIGGER}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                          {TIME_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Popover open={staffFromOpen} onOpenChange={setStaffFromOpen}>
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
                                setStaffFromOpen(false)
                              }}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Popover open={staffToOpen} onOpenChange={setStaffToOpen}>
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
                                setStaffToOpen(false)
                              }}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button size="sm" className="w-full cursor-pointer" onClick={handleCustomApply}>Apply</Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-[#666] whitespace-nowrap">
                  {data.staff.length} results
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table cursorPagination={cursorTable}>
                <TableHeader>
                  <TableRow className={TABLE_HEADER_ROW_CLASS}>
                    <TableHead className={HEAD_CLASS}>SL.</TableHead>
                    <TableHead className={HEAD_CLASS}>Employee</TableHead>
                    <TableHead className={HEAD_CLASS}>Role</TableHead>
                    <TableHead className={HEAD_CLASS}>Status</TableHead>
                    <TableHead className={HEAD_CLASS}>Appointments</TableHead>
                    <TableHead className={HEAD_CLASS}>Revenue</TableHead>
                    <TableHead className={HEAD_CLASS}>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.staff.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="px-4 py-10 text-sm text-muted-foreground">
                        No staff data found
                      </TableCell>
                    </TableRow>
                  ) : paginatedStaff.map((s, index) => (
                    <TableRow key={s.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                        {cursorTable.pageInfo.from + index}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              <User className="size-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span className="inline-flex rounded-full border border-[#e7e7e7] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-semibold text-[#555]">
                          {s.role}
                        </span>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          s.status === "ACTIVE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-[#e7e7e7] bg-[#f8fafc] text-[#555]"
                        )}>
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums")}>{s.appointments}</TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>{formatCurrency(s.revenue)}</TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-[#f2f2f2]">
                            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${s.efficiency}%` }} />
                          </div>
                          <span className="text-sm tabular-nums text-[#666]">{s.efficiency}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.staff.length > 0 && (
              <></>
            )}
          </div>
          </DashboardSection>

          {/* Top Performers */}
          {(topByAppointments || topByRevenue) && (
            <DashboardSection title="Top Performers">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {topByAppointments && (
                <div className="bg-card rounded-xl p-5 border border-border">
                  <h4 className="text-sm text-muted-foreground mb-3">Most Appointments</h4>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{topByAppointments.name}</p>
                      <p className="text-sm text-muted-foreground">{topByAppointments.appointments} appointments</p>
                    </div>
                  </div>
                </div>
              )}
              {topByRevenue && (
                <div className="bg-card rounded-xl p-5 border border-border">
                  <h4 className="text-sm text-muted-foreground mb-3">Highest Revenue</h4>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{topByRevenue.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(topByRevenue.revenue)} revenue</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </DashboardSection>
          )}
        </>
      )}
    </OverviewPage>
  )
}
