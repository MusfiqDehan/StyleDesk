"use client"

import { cn } from "@/lib/utils"

export type InvoiceStatusValue = "Paid" | "Partial" | "Unpaid"

interface InvoiceStatusBadgeProps {
  value: InvoiceStatusValue | string
  className?: string
}

/** Derive display status from invoice totals (never manual). */
export function deriveInvoiceStatus(
  amount: number,
  paidAmount?: number | null,
): InvoiceStatusValue {
  const tot = Math.max(0, Number(amount) || 0)
  const paid = Math.max(0, Number(paidAmount) || 0)
  if (paid <= 0) return "Unpaid"
  if (tot > 0 && paid + 0.009 >= tot) return "Paid"
  if (paid > 0 && paid < tot) return "Partial"
  return "Unpaid"
}

function normalizeStatus(status: string): InvoiceStatusValue {
  if (status === "Paid" || status === "Partial" || status === "Unpaid") return status
  if (status === "Due" || status === "Pending") return "Unpaid"
  return "Unpaid"
}

function statusStyle(status: InvoiceStatusValue) {
  switch (status) {
    case "Paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "Partial":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "Unpaid":
      return "border-rose-200 bg-rose-50 text-rose-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

export function InvoiceStatusBadge({ value, className }: InvoiceStatusBadgeProps) {
  const normalized = normalizeStatus(value)

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold",
        statusStyle(normalized),
        className,
      )}
    >
      {normalized}
    </span>
  )
}
