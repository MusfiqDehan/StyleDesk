"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Sparkles,
  UserRound,
} from "lucide-react"
import { useAuth } from "@admin/hooks/use-auth"
import { hasPermission } from "@admin/lib/auth-utils"
import { getAppointments } from "@admin/api/appointments/appointments"
import { AdminPageHeader } from "@admin/components/admin-page-header"
import {
  DashKpiCard,
  DashKpiGrid,
  DashboardEmptyState,
  DashboardSection,
  OverviewHeaderInsight,
  OverviewPage,
  OverviewPageLoader,
  OverviewSplitGrid,
  QuickLinksList,
  WidgetCard,
} from "@admin/components/dash"
import { cn } from "@/lib/utils"

interface AppointmentRecord {
  id: string
  clientName: string
  date: string
  time: string
  status: string
}

function toTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}`).getTime()
}

function formatTime12h(raw: string) {
  const [h = "0", m = "00"] = raw.split(":")
  const hour = Number.parseInt(h, 10) || 0
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${suffix}`
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

export default function StaffDashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !hasPermission(user, "staff-dashboard")) {
      router.replace("/admin")
    }
  }, [loading, user, router])

  useEffect(() => {
    const load = async () => {
      try {
        setAppointmentsLoading(true)
        const res = await getAppointments({ page: 1, limit: 300 })
        const list: AppointmentRecord[] = res?.data ?? []
        setAppointments(list)
      } catch {
        setAppointments([])
      } finally {
        setAppointmentsLoading(false)
      }
    }

    if (!loading && user?.role === "staff") {
      void load()
    }
  }, [loading, user?.role])

  const todayIso = new Date().toISOString().split("T")[0]
  const now = Date.now()

  const todays = useMemo(() => appointments.filter((a) => a.date === todayIso), [appointments, todayIso])
  const pending = useMemo(() => todays.filter((a) => a.status?.toLowerCase() === "pending").length, [todays])
  const completed = useMemo(() => todays.filter((a) => a.status?.toLowerCase() === "completed").length, [todays])
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => toTimestamp(a.date, a.time) >= now)
        .sort((a, b) => toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time))
        .slice(0, 6),
    [appointments, now],
  )

  const nextAppointment = upcoming[0]

  if (loading || !hasPermission(user, "staff-dashboard")) {
    return (
      <OverviewPage>
        <OverviewPageLoader label="Loading staff dashboard" />
      </OverviewPage>
    )
  }

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Staff"
        title="Staff Dashboard"
        subtitle="Your assigned work and daily overview"
        actions={
          <OverviewHeaderInsight label="Next Appointment">
            {appointmentsLoading ? (
              <p className="text-[#5f6368]">Loading…</p>
            ) : nextAppointment ? (
              <>
                <p className="font-semibold">{nextAppointment.clientName}</p>
                <p className="text-xs text-[#5f6368]">
                  {nextAppointment.date} at {formatTime12h(nextAppointment.time)}
                </p>
              </>
            ) : (
              <p className="text-[#5f6368]">No upcoming appointment</p>
            )}
          </OverviewHeaderInsight>
        }
      />

      <DashboardSection>
        <DashKpiGrid>
          <DashKpiCard
            title="Today"
            value={appointmentsLoading ? "—" : String(todays.length)}
            subtitle="Appointments scheduled"
            icon={CalendarDays}
            highlighted
          />
          <DashKpiCard
            title="Pending"
            value={appointmentsLoading ? "—" : String(pending)}
            subtitle="Need action"
            icon={Clock3}
            tone="warning"
          />
          <DashKpiCard
            title="Completed"
            value={appointmentsLoading ? "—" : String(completed)}
            subtitle="Done today"
            icon={CheckCircle2}
            tone="success"
          />
          <DashKpiCard
            title="Upcoming"
            value={appointmentsLoading ? "—" : String(upcoming.length)}
            subtitle="In your queue"
            icon={CalendarClock}
          />
        </DashKpiGrid>
      </DashboardSection>

      <DashboardSection title="Schedule & Focus">
        <OverviewSplitGrid>
          <WidgetCard
            title="Upcoming Appointments"
            icon={CalendarDays}
            action={{ label: "Full schedule", href: "/admin/appointments" }}
          >
            {appointmentsLoading ? (
              <p className="text-sm text-[#94a3b8]">Loading appointments…</p>
            ) : upcoming.length === 0 ? (
              <DashboardEmptyState title="No upcoming appointments" description="New bookings will appear here" />
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((appt) => (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-[#eef1f5] p-3.5 transition-colors hover:border-[#0076E9]/20 hover:bg-[#f8f9fb]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1a1d21]">{appt.clientName}</p>
                        <p className="mt-1 text-xs text-[#5f6368]">
                          {appt.date} at {formatTime12h(appt.time)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium capitalize",
                          getStatusBadge(appt.status),
                        )}
                      >
                        {appt.status || "pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WidgetCard>

          <div className="space-y-5">
            <WidgetCard title="Today's Focus" icon={ClipboardCheck}>
              <div className="space-y-2.5 text-sm">
                <FocusItem
                  title="Pending confirmations"
                  value={appointmentsLoading ? "—" : String(pending)}
                  icon={<Clock3 className="size-4 text-amber-500" />}
                />
                <FocusItem
                  title="Completed services"
                  value={appointmentsLoading ? "—" : String(completed)}
                  icon={<ClipboardCheck className="size-4 text-emerald-500" />}
                />
                <FocusItem title="Walk-in support" value="Ready" icon={<Sparkles className="size-4 text-[#0076E9]" />} />
              </div>
            </WidgetCard>

            <WidgetCard title="Quick Links" icon={UserRound}>
              <QuickLinksList
                items={[
                  {
                    href: "/admin/appointments",
                    label: "Appointment List",
                    icon: <CalendarDays className="size-4" />,
                  },
                  {
                    href: "/admin/clients",
                    label: "Clients",
                    icon: <UserRound className="size-4" />,
                  },
                  {
                    href: "/admin/leave-request",
                    label: "Leave Request",
                    icon: <Clock3 className="size-4" />,
                  },
                ]}
              />
            </WidgetCard>
          </div>
        </OverviewSplitGrid>
      </DashboardSection>
    </OverviewPage>
  )
}

function FocusItem({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#eef1f5] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#f8f9fb]">{icon}</span>
        <p className="text-[#5f6368]">{title}</p>
      </div>
      <p className="text-sm font-semibold text-[#1a1d21]">{value}</p>
    </div>
  )
}
