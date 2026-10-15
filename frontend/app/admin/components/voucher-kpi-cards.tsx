"use client"

import { Ticket, Banknote, HandCoins, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VoucherKpiStats } from "@admin/lib/vouchers"
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash"

function formatTk(value: number) {
  const abs = Math.abs(value || 0)
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)
  return value < 0 ? `-Tk.${formatted}` : `Tk.${formatted}`
}

interface VoucherKpiCardsProps {
  stats: VoucherKpiStats
  loading?: boolean
  className?: string
}

export function VoucherKpiCards({
  stats,
  loading = false,
  className,
}: Readonly<VoucherKpiCardsProps>) {
  const change = stats.netBalanceChangePercent ?? 0
  const isLower = change < 0
  const changeAbs = Math.abs(change)
  const period = stats.periodLabel || "Current Month"

  return (
    <DashKpiGrid className={className}>
      <DashKpiCard
        title="Total Vouchers"
        value={loading ? "—" : stats.totalVouchers}
        subtitle={period}
        icon={Ticket}
        tone="warning"
        highlighted
      />
      <DashKpiCard
        title="Total Income"
        value={loading ? "—" : formatTk(stats.totalIncome)}
        subtitle={period}
        icon={Banknote}
        tone="success"
        highlighted
      />
      <DashKpiCard
        title="Total Expense"
        value={loading ? "—" : formatTk(stats.totalExpense)}
        subtitle={period}
        icon={Banknote}
        tone="danger"
      />
      <DashKpiCard
        title="Net Balance"
        value={loading ? "—" : formatTk(stats.netBalance)}
        icon={HandCoins}
      >
        {!loading && (
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-sm leading-normal">
              <span className={cn(isLower ? "text-red-500" : "text-emerald-600")}>
                {changeAbs}%{" "}
              </span>
              <span className="text-brand-muted">
                {isLower ? "lower" : "higher"} than previous period
              </span>
            </p>
            {isLower ? (
              <TrendingDown className="size-5 shrink-0 text-red-500" aria-hidden />
            ) : (
              <TrendingUp className="size-5 shrink-0 text-emerald-600" aria-hidden />
            )}
          </div>
        )}
      </DashKpiCard>
    </DashKpiGrid>
  )
}
