"use client"
import { Table } from "@/components/ui/table"

import { AlertTriangle, Calendar, Sparkles } from "lucide-react"
import { RangeToggle } from "@admin/components/dash/range-toggle"
import { WidgetCard } from "@admin/components/dash/widget-card"
import { DashboardEmptyState } from "@admin/components/dash/states"
import { useDashboardChart } from "@admin/components/dash/use-dashboard-chart"
import {
  DASHBOARD_CHART_RANGE_OPTIONS,
  type TopServiceChartPoint,
} from "@admin/api/dashboard/charts"
import { cn } from "@/lib/utils"

interface DashboardAppointment {
  id: string
  clientName: string
  time: string
  services: string[]
  status: string
  staff: string | null
}

interface LowStockItem {
  id: string
  name: string
  category: string
  stockQty: number
  minStockLevel: number
}

interface TodaysAppointmentsProps {
  appointments: DashboardAppointment[]
}

interface LowStockAlertsProps {
  items: LowStockItem[]
}

function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase() ?? ""
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "in service": "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-sky-50 text-sky-700 border-sky-200",
    "checked in": "bg-violet-50 text-violet-700 border-violet-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  }
  return styles[normalized] ?? "bg-slate-50 text-slate-600 border-slate-200"
}

export function TodaysAppointments({ appointments }: TodaysAppointmentsProps) {
  return (
    <WidgetCard
      title="Today's Schedule"
      icon={Calendar}
      action={{ label: "View all", href: "/admin/invoices?date=today" }}
    >
      {appointments.length === 0 ? (
        <DashboardEmptyState title="No appointments today" description="New bookings will show up here" />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <Table className="w-full min-w-[320px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#eef1f5] text-[#1a1d21]">
                <th className="px-1 py-2 font-semibold" scope="col">Client</th>
                <th className="px-1 py-2 font-semibold" scope="col">Service</th>
                <th className="px-1 py-2 font-semibold" scope="col">Staff</th>
                <th className="px-1 py-2 font-semibold" scope="col">Time</th>
                <th className="px-1 py-2 font-semibold" scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr
                  key={appt.id}
                  className="border-b border-[#f8f9fb] last:border-0 transition-colors hover:bg-[#f8f9fb]/80"
                >
                  <td className="px-1 py-3 font-medium text-[#1a1d21]">{appt.clientName}</td>
                  <td className="max-w-[120px] truncate px-1 py-3 text-[#5f6368]">
                    {appt.services?.join(", ") || "—"}
                  </td>
                  <td className="px-1 py-3 text-[#5f6368]">{appt.staff || "Any"}</td>
                  <td className="px-1 py-3 text-[#5f6368] whitespace-nowrap">{appt.time}</td>
                  <td className="px-1 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        getStatusBadge(appt.status),
                      )}
                    >
                      {appt.status || "pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </WidgetCard>
  )
}

export function LowStockAlerts({ items }: LowStockAlertsProps) {
  return (
    <WidgetCard
      title="Low Stock Alerts"
      icon={AlertTriangle}
      action={{ label: "View all", href: "/admin/inventory" }}
    >
      {items.length === 0 ? (
        <DashboardEmptyState title="Inventory is healthy" description="All items above minimum levels" />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[#eef1f5] bg-[#fafbfc] p-3 transition-colors hover:border-rose-200"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1a1d21]">{item.name}</p>
                <p className="text-[11px] text-[#5f6368]">{item.category}</p>
              </div>
              <div className="ml-4 text-right">
                <p className="text-sm font-bold text-rose-600">{item.stockQty}</p>
                <p className="text-[10px] text-[#94a3b8]">left</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

export function TopServices() {
  const {
    range,
    setRange,
    points: services,
    loading,
    refreshing,
    error,
    retry,
  } = useDashboardChart<TopServiceChartPoint>({ metric: "top-services" })

  const maxCount = services.length > 0
    ? Math.max(...services.map((s) => s.count))
    : 1

  return (
    <WidgetCard
      title="Top Services"
      icon={Sparkles}
      headerExtra={
        <div className="flex items-center gap-2">
          {refreshing && (
            <span
              className="inline-block size-3 animate-spin rounded-full border-2 border-[#0076E9]/25 border-t-[#0076E9]"
              aria-label="Refreshing"
            />
          )}
          <RangeToggle
            value={range}
            options={DASHBOARD_CHART_RANGE_OPTIONS}
            onChange={setRange}
          />
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-[#eef1f5]" />
          ))}
        </div>
      ) : error ? (
        <div className="py-6 text-center text-xs text-rose-600">
          {error}
          <button
            type="button"
            onClick={retry}
            className="ml-2 font-medium text-[#0076E9] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : services.length === 0 ? (
        <DashboardEmptyState title="No service data" description="Bookings will populate this chart" />
      ) : (
        <div className={cn("space-y-4", refreshing && "opacity-60 transition-opacity")}>
          {services.map((service, i) => {
            const pct = (service.count / maxCount) * 100
            return (
              <div key={service.name}>
                <div className="mb-1.5 flex items-center justify-between text-xs text-[#5f6368]">
                  <span className="truncate pr-2 font-medium text-[#1a1d21]">
                    <span className="mr-1.5 text-[#94a3b8]">#{i + 1}</span>
                    {service.name}
                  </span>
                  <span className="shrink-0 tabular-nums">{service.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eef1f5]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0076E9] to-[#29b6f6] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={service.count}
                    aria-valuemin={0}
                    aria-valuemax={maxCount}
                    aria-label={`${service.name}: ${service.count} bookings`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetCard>
  )
}
