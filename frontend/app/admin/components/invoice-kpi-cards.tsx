"use client"

import { FileText, Banknote, CircleAlert, FileSearch } from "lucide-react"
import { cn } from "@/lib/utils"
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash"

function formatTk(value: number) {
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`
}

export interface InvoiceKpiItem {
  amount: number
  paidAmount?: number
  status: "Paid" | "Unpaid" | "Partial"
  source: "online" | "offline"
}

interface InvoiceKpiCardsProps {
  invoices: InvoiceKpiItem[]
  className?: string
  onTotalDueClick?: () => void
  totalDueActive?: boolean
}

export function InvoiceKpiCards({
  invoices,
  className,
  onTotalDueClick,
  totalDueActive = false,
}: InvoiceKpiCardsProps) {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const invoiceCount = invoices.length

  const paidInvoices = invoices.filter((inv) => inv.status === "Paid")
  const totalCollected = invoices.reduce((sum, inv) => {
    if (inv.status === "Paid") return sum + inv.amount
    if (inv.status === "Partial") return sum + (inv.paidAmount ?? 0)
    return sum
  }, 0)

  const withBalance = invoices.filter((inv) => {
    if (inv.status === "Unpaid") return inv.amount > 0
    if (inv.status === "Partial") return inv.amount - (inv.paidAmount ?? 0) > 0
    return false
  })
  const totalDue = withBalance.reduce((sum, inv) => {
    if (inv.status === "Unpaid") return sum + inv.amount
    return sum + Math.max(0, inv.amount - (inv.paidAmount ?? 0))
  }, 0)

  const offlineCount = invoices.filter((inv) => inv.source === "offline").length
  const onlineCount = invoices.filter((inv) => inv.source === "online").length
  const leadDiff = Math.abs(offlineCount - onlineCount)
  const leadLabel =
    offlineCount === onlineCount
      ? "Equal sources"
      : offlineCount > onlineCount
        ? `Offline leads by ${leadDiff}`
        : `Online leads by ${leadDiff}`

  return (
    <DashKpiGrid className={className}>
      <DashKpiCard
        title="Total Invoiced"
        value={formatTk(totalInvoiced)}
        subtitle={`${invoiceCount} Invoice${invoiceCount === 1 ? "" : "s"}`}
        icon={FileText}
        highlighted
      />
      <DashKpiCard
        title="Total Collected"
        value={formatTk(totalCollected)}
        subtitle={`${paidInvoices.length} Paid`}
        icon={Banknote}
        tone="success"
      />
      <DashKpiCard
        title="Total Due"
        value={formatTk(totalDue)}
        subtitle={`${withBalance.length} with balance${onTotalDueClick ? " · click to view unpaid & partial" : ""}`}
        icon={CircleAlert}
        tone="danger"
        highlighted={totalDueActive}
        onClick={onTotalDueClick}
        className={cn(
          onTotalDueClick && "hover:border-rose-200 hover:bg-rose-50/40",
          totalDueActive && "border-rose-500 ring-rose-500/15",
        )}
      />
      <DashKpiCard
        title="Billing Source"
        value={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>{offlineCount}</span>
              <span className="text-sm font-normal text-brand-muted">Offline</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{onlineCount}</span>
              <span className="text-sm font-normal text-brand-muted">Online</span>
            </div>
          </div>
        }
        subtitle={leadLabel}
        icon={FileSearch}
        tone="neutral"
      />
    </DashKpiGrid>
  )
}
