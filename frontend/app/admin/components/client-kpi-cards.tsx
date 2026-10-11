"use client"

import { Users, UserPlus, Banknote, CircleAlert } from "lucide-react"
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash"

function formatTk(value: number) {
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`
}

export interface ClientKpiItem {
  id: string
  visits: number
  totalSpent: number
  firstVisit: string | null
  lastVisit: string | null
  invoices?: Array<{
    total?: number | string | null
    paidAmount?: number | string | null
    status?: string | null
  }>
}

interface ClientKpiCardsProps {
  clients: ClientKpiItem[]
  loading?: boolean
  className?: string
}

function getDueAmount(client: ClientKpiItem) {
  return (client.invoices ?? []).reduce((sum, invoice) => {
    if ((invoice.status ?? "").toLowerCase() === "paid") return sum
    const total = Number(invoice.total) || 0
    const paid = Number(invoice.paidAmount) || 0
    return sum + Math.max(0, total - paid)
  }, 0)
}

function isInCurrentMonth(iso: string | null | undefined) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isVisitedWithinDays(iso: string | null | undefined, days: number) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days)
  return d >= cutoff
}

export function ClientKpiCards({
  clients,
  loading = false,
  className,
}: Readonly<ClientKpiCardsProps>) {
  const totalClients = clients.length
  const newThisMonth = clients.filter((c) => isInCurrentMonth(c.firstVisit)).length
  const totalSpent = clients.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0)
  const withDue = clients.filter((c) => getDueAmount(c) > 0)
  const outstandingDue = withDue.reduce((sum, c) => sum + getDueAmount(c), 0)
  const activeRecently = clients.filter((c) => isVisitedWithinDays(c.lastVisit, 30)).length

  return (
    <DashKpiGrid className={className}>
      <DashKpiCard
        title="Total Clients"
        value={loading ? "—" : totalClients}
        subtitle={loading ? "—" : `${activeRecently} active in last 30 days`}
        icon={Users}
        highlighted
      />
      <DashKpiCard
        title="New Clients"
        value={loading ? "—" : newThisMonth}
        subtitle="First visit this month"
        icon={UserPlus}
      />
      <DashKpiCard
        title="Total Spent"
        value={loading ? "—" : formatTk(totalSpent)}
        subtitle="Lifetime client revenue"
        icon={Banknote}
        tone="success"
      />
      <DashKpiCard
        title="Outstanding Due"
        value={loading ? "—" : formatTk(outstandingDue)}
        subtitle={
          loading
            ? "—"
            : `${withDue.length} client${withDue.length === 1 ? "" : "s"} with balance`
        }
        icon={CircleAlert}
        tone="danger"
      />
    </DashKpiGrid>
  )
}
