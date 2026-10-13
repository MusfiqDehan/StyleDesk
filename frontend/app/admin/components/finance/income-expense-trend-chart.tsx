"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { ChartCard } from "@admin/components/dash/chart-card"
import { RangeToggle } from "@admin/components/dash/range-toggle"
import { useDashboardChart } from "@admin/components/dash/use-dashboard-chart"
import { DASH, financeChartConfig } from "@admin/components/dash/tokens"
import {
  DASHBOARD_CHART_RANGE_OPTIONS,
  mapFinancePoints,
  type FinanceChartPoint,
} from "@admin/api/dashboard/charts"
import { DashboardEmptyState } from "@admin/components/dash/states"

type FinanceSeriesKey = "income" | "expense" | "paid" | "due"

const SERIES_META: Record<FinanceSeriesKey, { label: string; color: string }> = {
  income: { label: "Income", color: "#27b85e" },
  expense: { label: "Expense", color: "#ef4444" },
  paid: { label: "Paid", color: "#0076E9" },
  due: { label: "Due", color: "#f59e0b" },
}

function formatAxisLabel(value: number) {
  const k = value / 1000
  if (k >= 1000) return `${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}M`
  if (Number.isInteger(k)) return `${k}k`
  return `${k.toFixed(1)}k`
}

function formatTooltip(value: number) {
  return `BDT ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`
}

interface IncomeExpenseTrendChartProps {
  className?: string
}

export function IncomeExpenseTrendChart({
  className,
}: Readonly<IncomeExpenseTrendChartProps>) {
  const {
    range,
    setRange,
    points,
    loading,
    refreshing,
    error,
    retry,
  } = useDashboardChart<FinanceChartPoint>({
    metric: "finance",
    mapPoints: mapFinancePoints,
  })

  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  const showBrush = points.length > 8

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const extendedConfig = {
    ...financeChartConfig,
    paid: { label: "Paid", color: "#0076E9" },
    due: { label: "Due", color: "#f59e0b" },
  }

  return (
    <ChartCard
      title="Income vs Expense Trend"
      subtitle="Cash flow from dashboard finance chart API"
      className={className}
      height={showBrush ? 340 : 320}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={retry}
      actions={
        <RangeToggle
          value={range}
          options={DASHBOARD_CHART_RANGE_OPTIONS}
          onChange={setRange}
        />
      }
    >
      {points.length === 0 && !refreshing ? (
        <DashboardEmptyState title="No finance data" className="py-16" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(SERIES_META) as FinanceSeriesKey[]).map((key) => {
              const hidden = hiddenSeries.has(key)
              const { label, color } = SERIES_META[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSeries(key)}
                  aria-pressed={!hidden}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-opacity",
                    hidden ? "opacity-40" : "opacity-100",
                    "border-[#e8eaed] text-[#5f6368] hover:border-[#0076E9]/30",
                  )}
                >
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </button>
              )
            })}
          </div>
          <ChartContainer
            config={extendedConfig}
            className={cn(
              "h-full w-full min-h-[220px] aspect-auto",
              refreshing && "opacity-60 transition-opacity",
            )}
          >
            <BarChart
              data={points}
              barGap={2}
              margin={{ top: 8, right: 8, left: 0, bottom: showBrush ? 24 : 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DASH.gridStroke} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: DASH.tickFill }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: DASH.tickFill }}
                tickFormatter={formatAxisLabel}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatTooltip(Number(value))} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {!hiddenSeries.has("income") && (
                <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} barSize={14} />
              )}
              {!hiddenSeries.has("expense") && (
                <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} barSize={14} />
              )}
              {!hiddenSeries.has("paid") && (
                <Bar dataKey="paid" fill="var(--color-paid)" radius={[4, 4, 0, 0]} barSize={14} />
              )}
              {!hiddenSeries.has("due") && (
                <Bar dataKey="due" fill="var(--color-due)" radius={[4, 4, 0, 0]} barSize={14} />
              )}
              {showBrush && (
                <Brush
                  dataKey="date"
                  height={18}
                  stroke={DASH.primary}
                  fill="#f0f4ff"
                  travellerWidth={8}
                  tickFormatter={(_, index) => points[index]?.label ?? ""}
                />
              )}
            </BarChart>
          </ChartContainer>
        </>
      )}
    </ChartCard>
  )
}
