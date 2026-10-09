"use client"
import { Table } from "@/components/ui/table"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarCheck2,
  CalendarDays,
  CalendarFold,
  CheckCircle2,
  Plus,
  Sparkles,
  User,
  UserRound,
  Users,
  Zap,
} from "lucide-react"
import { useAuth } from "@admin/hooks/use-auth"
import { hasPermission } from "@admin/lib/auth-utils"
import { getAppointments } from "@admin/api/appointments/appointments"
import {
  AdminPageHeader,
  AdminHeaderPrimaryButton,
  AdminHeaderSecondaryButton,
} from "@admin/components/admin-page-header"
import {
  DashKpiCard,
  DashKpiGrid,
  DashboardEmptyState,
  DashboardSection,
  OverviewPage,
  OverviewPageLoader,
  OverviewSplitGrid,
  QuickLinksList,
  WidgetCard,
} from "@admin/components/dash"

interface AppointmentRecord {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  time: string
  source: string
  status: string
  staff: string | null
  services: string[] | null
}

function toTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}`).getTime()
}

function normalizeStatus(raw: string) {
  return (raw ?? "pending").trim().toLowerCase()
}

function formatTime12h(raw: string) {
  const [h = "0", m = "00"] = raw.split(":")
  const hour = Number.parseInt(h, 10) || 0
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${suffix}`
}

function normalizeStaffName(raw?: string | null) {
  return (raw ?? "").trim().toLowerCase()
}

export default function StylistDashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const canAccessStylistDashboard = hasPermission(user, "stylist-dashboard")
  const stylistName = (user?.employeeName ?? "").trim()

  useEffect(() => {
    if (!loading && !canAccessStylistDashboard) {
      router.replace("/admin")
    }
  }, [loading, canAccessStylistDashboard, router])

  useEffect(() => {
    const fetchStylistAppointments = async () => {
      if (!user || user.role !== "stylist") {
        setAppointmentsLoading(false)
        return
      }

      const name = (user.employeeName ?? "").trim()
      if (!name) {
        setAppointments([])
        setAppointmentsLoading(false)
        return
      }

      try {
        setAppointmentsLoading(true)
        const res = await getAppointments({ page: 1, limit: 1000, staff: name } as any)
        const list: AppointmentRecord[] = res?.data ?? []
        const ownedAppointments = list.filter(
          (appt) => normalizeStaffName(appt.staff) === normalizeStaffName(name),
        )
        setAppointments(ownedAppointments)
      } catch {
        setAppointments([])
      } finally {
        setAppointmentsLoading(false)
      }
    }

    if (!loading) {
      void fetchStylistAppointments()
    }
  }, [user, loading])

  const todayIso = new Date().toISOString().split("T")[0]
  const now = Date.now()

  const todaysAppointments = useMemo(
    () =>
      appointments
        .filter((appt) => appt.date === todayIso)
        .sort((a, b) => toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time)),
    [appointments, todayIso],
  )

  const uniqueClients = useMemo(() => {
    const ids = new Set(appointments.map((appt) => appt.phoneNumber || `${appt.clientName}-${appt.date}`))
    return ids.size
  }, [appointments])

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((appt) => toTimestamp(appt.date, appt.time) >= now)
        .sort((a, b) => toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time))
        .slice(0, 8),
    [appointments, now],
  )

  const thisWeekStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const weekAppointments = useMemo(
    () => appointments.filter((appt) => toTimestamp(appt.date, appt.time) >= thisWeekStart),
    [appointments, thisWeekStart],
  )

  const statusCount = useMemo(() => {
    const result = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
    for (const appt of weekAppointments) {
      const status = normalizeStatus(appt.status)
      if (status === "confirmed") result.confirmed += 1
      else if (status === "completed") result.completed += 1
      else if (status === "cancelled") result.cancelled += 1
      else result.pending += 1
    }
    return result
  }, [weekAppointments])

  const completionRate = useMemo(() => {
    if (weekAppointments.length === 0) return 0
    return Math.round((statusCount.completed / weekAppointments.length) * 100)
  }, [statusCount.completed, weekAppointments.length])

  if (loading || !canAccessStylistDashboard) {
    return (
      <OverviewPage>
        <OverviewPageLoader label="Loading artist dashboard" />
      </OverviewPage>
    )
  }

  if (!stylistName) {
    return (
      <OverviewPage>
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="mb-2 text-2xl font-bold text-amber-700">Artist Profile Not Linked</h1>
          <p className="text-sm text-amber-700/90">
            Your login is not linked to an employee profile yet. Ask admin to connect this account to your artist profile.
          </p>
        </div>
      </OverviewPage>
    )
  }

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Artist"
        title="Artist Dashboard"
        subtitle="Manage your appointments and client schedule"
        actions={
          <>
            <AdminHeaderPrimaryButton onClick={() => router.push("/admin/appointments?new=true")} accessAction="create">
              <Plus />
              Add Appointment
            </AdminHeaderPrimaryButton>
            <AdminHeaderSecondaryButton onClick={() => router.push("/admin/appointments")}>
              <CalendarDays />
              Open Schedule
            </AdminHeaderSecondaryButton>
          </>
        }
      />

      <DashboardSection>
        <DashKpiGrid>
          <DashKpiCard
            title="Today"
            value={appointmentsLoading ? "—" : todaysAppointments.length}
            subtitle="appointments assigned to you"
            icon={CalendarCheck2}
            highlighted
          />
          <DashKpiCard
            title="Upcoming"
            value={appointmentsLoading ? "—" : upcomingAppointments.length}
            subtitle="next in queue"
            icon={CalendarFold}
          />
          <DashKpiCard
            title="This Week Done"
            value={appointmentsLoading ? "—" : statusCount.completed}
            subtitle="completed appointments"
            icon={CheckCircle2}
            tone="success"
          />
          <DashKpiCard
            title="Unique Clients"
            value={appointmentsLoading ? "—" : uniqueClients}
            subtitle="clients served by you"
            icon={UserRound}
            tone="neutral"
          />
        </DashKpiGrid>
      </DashboardSection>

      <DashboardSection title="Today's Queue">
        <OverviewSplitGrid>
          <WidgetCard
            title="Today's Queue"
            icon={CalendarDays}
            headerExtra={<span className="text-xs text-[#5f6368]">Only your appointments</span>}
          >
            {appointmentsLoading ? (
              <p className="grid h-48 place-items-center text-sm text-[#94a3b8]">Loading appointments…</p>
            ) : todaysAppointments.length === 0 ? (
              <DashboardEmptyState title="No appointments today" description="Your schedule is clear for now" />
            ) : (
              <div className="max-h-[340px] overflow-auto">
                <Table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#eef1f5] text-xs text-[#5f6368]">
                      <th className="py-2 font-medium" scope="col">
                        Client
                      </th>
                      <th className="py-2 font-medium" scope="col">
                        Services
                      </th>
                      <th className="py-2 font-medium" scope="col">
                        Time
                      </th>
                      <th className="py-2 font-medium" scope="col">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysAppointments.slice(0, 6).map((appt) => (
                      <tr key={appt.id} className="border-b border-[#f8f9fb] last:border-b-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-full bg-[#f8f9fb]">
                              <User className="size-4 text-[#5f6368]" />
                            </span>
                            <div>
                              <p className="font-medium text-[#1a1d21]">{appt.clientName}</p>
                              <p className="text-xs text-[#5f6368]">{appt.phoneNumber || "No phone"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[240px] truncate py-3 text-[#1a1d21]">
                          {(appt.services ?? []).join(", ") || "—"}
                        </td>
                        <td className="py-3 text-[#1a1d21]">{formatTime12h(appt.time)}</td>
                        <td className="py-3">
                          <span className="inline-flex rounded-md bg-[#f8f9fb] px-2 py-1 text-xs font-medium capitalize text-[#1a1d21]">
                            {normalizeStatus(appt.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </WidgetCard>

          <div className="space-y-5">
            <WidgetCard title="Weekly Status" icon={CheckCircle2}>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Pending", value: statusCount.pending },
                  { label: "Confirmed", value: statusCount.confirmed },
                  { label: "Completed", value: statusCount.completed },
                  { label: "Cancelled", value: statusCount.cancelled },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[#5f6368]">{row.label}</span>
                    <span className="font-semibold text-[#1a1d21]">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#eef1f5] pt-4">
                <p className="text-sm text-[#5f6368]">Completion Rate</p>
                <p className="text-xl font-bold text-emerald-600">{completionRate}%</p>
              </div>
            </WidgetCard>

            <WidgetCard title="Next Appointments" icon={Sparkles}>
              {appointmentsLoading ? (
                <p className="text-sm text-[#94a3b8]">Loading…</p>
              ) : upcomingAppointments.length === 0 ? (
                <DashboardEmptyState title="No upcoming appointments" className="py-8" />
              ) : (
                <div className="space-y-2.5">
                  {upcomingAppointments.slice(0, 4).map((appt) => (
                    <div key={appt.id} className="rounded-xl border border-[#eef1f5] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#1a1d21]">{appt.clientName}</p>
                          <p className="text-xs text-[#5f6368]">
                            {appt.date} at {formatTime12h(appt.time)}
                          </p>
                        </div>
                        <Sparkles className="size-4 text-[#0076E9]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WidgetCard>

            <WidgetCard title="Quick Links" icon={Users}>
              <QuickLinksList
                items={[
                  { href: "/admin/appointments", label: "My appointments list", icon: <CalendarDays className="size-4" /> },
                  { href: "/admin/clients", label: "Client profiles", icon: <Users className="size-4" /> },
                  { href: "/admin/leave-request", label: "Request leave", icon: <Zap className="size-4" /> },
                ]}
              />
            </WidgetCard>
          </div>
        </OverviewSplitGrid>
      </DashboardSection>

      <p className="flex items-center gap-2 text-xs text-[#5f6368]">
        <CheckCircle2 className="size-4 text-emerald-500" />
        Data scope locked: this page shows only appointments assigned to{" "}
        <span className="font-semibold text-[#1a1d21]">{stylistName}</span>.
      </p>
    </OverviewPage>
  )
}
