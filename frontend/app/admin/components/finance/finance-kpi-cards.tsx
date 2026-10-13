"use client"

import {
  Banknote,
  HandCoins,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FinanceOverview } from "@admin/api/finance/finance"
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash"

function formatTk(value: number) {
  const abs = Math.abs(value || 0)
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)
  return value < 0 ? `-Tk.${formatted}` : `Tk.${formatted}`
}

interface FinanceKpiCardsProps {
  data: FinanceOverview | null
  loading?: boolean
  className?: string
}

export function FinanceKpiCards({
  data,
  loading = false,
  className,
}: Readonly<FinanceKpiCardsProps>) {
  const period = data?.periodLabel || "All time"
  const yoyDirection = data?.netYoYDirection
  const yoyHigher = yoyDirection === "higher"
  const yoyLower = yoyDirection === "lower"
  const yoyLabel =
    data?.netYoYLabel ||
    (yoyHigher
      ? "Higher than previous year"
      : yoyLower
        ? "Lower than previous year"
        : "Same as previous year")

  return (
    <DashKpiGrid className={className}>
      <DashKpiCard
        title="Total Income"
        value={loading ? "—" : formatTk(data?.totalIncome ?? 0)}
        subtitle={period}
        icon={Banknote}
        tone="success"
        highlighted
      />
      <DashKpiCard
        title="Total Expense"
        value={loading ? "—" : formatTk(data?.totalExpense ?? 0)}
        subtitle={period}
        icon={Banknote}
        tone="danger"
      />
      <DashKpiCard
        title="Net Balance"
        value={
          <span className={cn(!loading && (data?.netBalance ?? 0) < 0 && "text-red-500")}>
            {loading ? "—" : formatTk(data?.netBalance ?? 0)}
          </span>
        }
        icon={HandCoins}
      >
        {!loading && (
          <div className="flex flex-wrap items-center gap-1">
            <p
              className={cn(
                "text-sm font-medium leading-normal",
                yoyHigher ? "text-emerald-600" : yoyLower ? "text-red-500" : "text-brand-muted",
              )}
            >
              {yoyLabel}
            </p>
            {yoyHigher ? (
              <TrendingUp className="size-5 shrink-0 text-emerald-600" aria-hidden />
            ) : yoyLower ? (
              <TrendingDown className="size-5 shrink-0 text-red-500" aria-hidden />
            ) : null}
          </div>
        )}
      </DashKpiCard>
      <DashKpiCard
        title="Entries Logged"
        value={loading ? "—" : data?.entriesLogged ?? 0}
        subtitle={period}
        icon={ClipboardCheck}
        tone="warning"
      />
    </DashKpiGrid>
  )
}
