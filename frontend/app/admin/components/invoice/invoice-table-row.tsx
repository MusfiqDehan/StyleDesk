"use client"

import { Printer, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { cn, formatMoney } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  InvoiceStatusBadge,
  deriveInvoiceStatus,
  type InvoiceStatusValue,
} from "./invoice-status-badge"

export interface InvoiceTableRowData {
  id: string
  invoiceNo: string
  client: string
  clientPhone: string
  services: string[]
  packageNames?: string[]
  amount: number
  paidAmount?: number
  paymentMethod?: string
  staff: string
  date: string
  status: InvoiceStatusValue
  source: "online" | "offline"
}

interface InvoiceTableRowProps {
  invoice: InvoiceTableRowData
  index: number
  pageOffset: number
  isUnread?: boolean
  onView?: (invoice: InvoiceTableRowData) => void
  onPrint?: (invoice: InvoiceTableRowData) => void
  onDelete?: (invoice: InvoiceTableRowData) => void
  className?: string
}

export function InvoiceTableRow({
  invoice,
  index,
  pageOffset,
  isUnread = false,
  onView,
  onPrint,
  onDelete,
  className,
}: InvoiceTableRowProps) {
  const received = Math.max(0, Number(invoice.paidAmount) || 0)
  const dueAmount = Math.max(0, (Number(invoice.amount) || 0) - received)
  const status = deriveInvoiceStatus(invoice.amount, received)

  const dateLabel = (() => {
    try {
      if (!invoice.date) return "—"
      return format(new Date(`${invoice.date}T00:00:00`), "dd MMM yyyy")
    } catch {
      return invoice.date
    }
  })()

  return (
    <TableRow
      className={cn(
        "border-b border-[#f2f2f2] cursor-pointer transition-colors",
        isUnread ? "bg-[#f5faff] hover:bg-brand-soft" : "hover:bg-[#f0f7ff]",
        className,
      )}
      onClick={() => onView?.(invoice)}
    >
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] tabular-nums text-[#666]">
        {pageOffset + index + 1}
      </TableCell>
      <TableCell className="px-2 py-3 first:pl-4 last:pr-4 text-left">
        {isUnread ? (
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5",
              "text-[10px] font-bold uppercase tracking-wide",
              "bg-brand-primary text-white shadow-sm",
            )}
          >
            New
          </span>
        ) : null}
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium text-[#333] truncate"
        title={invoice.invoiceNo}
      >
        {invoice.invoiceNo}
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium text-[#333] truncate"
        title={invoice.client}
      >
        {invoice.client}
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate"
        title={invoice.clientPhone}
      >
        {invoice.clientPhone || "—"}
      </TableCell>
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium tabular-nums text-[#333]">
        {formatMoney(invoice.amount)}
      </TableCell>
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium tabular-nums text-emerald-700">
        {formatMoney(received)}
      </TableCell>
      <TableCell
        className={cn(
          "px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium tabular-nums",
          dueAmount > 0 ? "text-rose-600" : "text-[#333]",
        )}
      >
        {formatMoney(dueAmount)}
      </TableCell>
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333]">
        <span
          className={cn(
            "inline-flex h-7 min-w-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold",
            invoice.source === "online"
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-cyan-200 bg-cyan-50 text-cyan-700",
          )}
        >
          {invoice.source === "online" ? "Online" : "Walk In"}
        </span>
      </TableCell>
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left">
        <InvoiceStatusBadge value={status} />
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate"
        title={invoice.paymentMethod || undefined}
      >
        {invoice.paymentMethod?.trim() ? invoice.paymentMethod : "—"}
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate"
        title={invoice.staff}
      >
        {invoice.staff || "—"}
      </TableCell>
      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333]">
        {dateLabel}
      </TableCell>
      <TableCell
        className="px-3 py-3 first:pl-4 last:pr-4 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg bg-[#f3f0ff] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
            aria-label="Print invoice"
            onClick={() => onPrint?.(invoice)}
          >
            <Printer className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg bg-[#fff1f2] text-[#e11d48] hover:bg-[#e11d48] hover:text-white"
            aria-label="Delete invoice"
            onClick={() => onDelete?.(invoice)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
