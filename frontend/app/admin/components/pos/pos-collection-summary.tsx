"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { getInvoices } from "@admin/api/billing/billing"
import { formatTk } from "./pos-utils"

export const POS_COLLECTION_REFRESH_EVENT = "pos:collection-refresh"

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function datePart(value?: string | null) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function Chip({
  label,
  amount,
}: Readonly<{
  label: string
  amount: number
}>) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-brand-line bg-white px-3 py-1.5 sm:px-4">
      <span className="min-w-0 truncate text-sm font-medium capitalize text-brand-muted">
        {label}
      </span>
      <span className="shrink-0 rounded-lg bg-brand-mist px-2 py-0.5 text-sm font-medium leading-[18px] whitespace-nowrap text-brand-primary">
        {formatTk(amount)}
      </span>
    </div>
  )
}

interface PosCollectionSummaryProps {
  className?: string
}

export function PosCollectionSummary({ className }: PosCollectionSummaryProps) {
  const [transactionsToday, setTransactionsToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const today = todayIsoDate()
    try {
      const invoiceRes = await getInvoices(1, 200, true, { date: today })

      const invoices = Array.isArray(invoiceRes?.data)
        ? invoiceRes.data
        : Array.isArray(invoiceRes)
          ? invoiceRes
          : []

      const todaysPayments = invoices.reduce((sum: number, inv: any) => {
        const created = datePart(inv.confirmedAt || inv.createdAt)
        if (created !== today) return sum
        return sum + Math.max(0, Number(inv.paidAmount) || 0)
      }, 0)

      setTransactionsToday(todaysPayments)
    } catch (err) {
      console.error("Failed to load POS collection summary:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onRefresh = () => {
      void load()
    }
    window.addEventListener(POS_COLLECTION_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(POS_COLLECTION_REFRESH_EVENT, onRefresh)
  }, [load])

  return (
    <div
      className={cn(
        "flex w-full items-stretch gap-2 sm:gap-3",
        loading && "opacity-70",
        className,
      )}
      aria-busy={loading}
    >
      <Chip label="Transaction’s Today" amount={transactionsToday} />
      <Chip label="Net Collection" amount={transactionsToday} />
    </div>
  )
}

export function refreshPosCollectionSummary() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(POS_COLLECTION_REFRESH_EVENT))
}
