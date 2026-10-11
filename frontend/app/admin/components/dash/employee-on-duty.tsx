"use client"
import { Table } from "@/components/ui/table"

import Link from "next/link"
import { Users } from "lucide-react"
import { formatTime, type AttendanceRecord } from "@admin/api/attendance/attendance"
import { WidgetCard } from "./widget-card"
import { DashboardEmptyState } from "./states"

interface EmployeeOnDutyProps {
  records: AttendanceRecord[]
  loading?: boolean
  activeEmployeesCount?: number
}

export function EmployeeOnDuty({
  records,
  loading = false,
  activeEmployeesCount = 0,
}: EmployeeOnDutyProps) {
  const absent = Math.max(0, activeEmployeesCount - records.length)

  return (
    <WidgetCard
      title={`Employee On Duty (${loading ? "…" : records.length})`}
      icon={Users}
      action={{ label: "View all", href: "/admin/attendance" }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[var(--brand-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-emerald-500" aria-hidden />
          {loading ? "…" : records.length} Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-rose-500" aria-hidden />
          {loading ? "…" : absent} Absent
        </span>
      </div>

      <div className="overflow-x-auto border-t border-[var(--brand-soft)] pt-2">
        <Table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--brand-soft)] text-[var(--brand-ink)]">
              <th className="py-2 font-semibold" scope="col">Name</th>
              <th className="py-2 font-semibold" scope="col">Check In</th>
              <th className="py-2 font-semibold" scope="col">Check Out</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-[#94a3b8]">
                  Loading attendance…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <DashboardEmptyState
                    title="No attendance today"
                    description="Check-ins will appear here in real time"
                    icon={Users}
                    className="py-8"
                  />
                </td>
              </tr>
            ) : (
              records.map((rec, i) => (
                <tr key={rec.id ?? i} className="border-b border-[var(--brand-mist)] last:border-0">
                  <td className="py-2.5 font-medium text-[var(--brand-ink)]">{rec.employeeName}</td>
                  <td className="py-2.5 text-[var(--brand-muted)]">{formatTime(rec.checkInTime)}</td>
                  <td className="py-2.5 text-[var(--brand-muted)]">{formatTime(rec.checkOutTime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </WidgetCard>
  )
}
