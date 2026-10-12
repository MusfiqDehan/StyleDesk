"use client"

import { useEffect, useState } from "react"
import { CalendarDays, TrendingUp } from "lucide-react"
import {
  Area,
  AreaChart,
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
import { formatCurrency } from "@/lib/utils"
import { ChartCard } from "@admin/components/dash/chart-card"
import { RangeToggle } from "@admin/components/dash/range-toggle"
import { useDashboardChart } from "@admin/components/dash/use-dashboard-chart"
import {
  appointmentsChartConfig,
  DASH,
  revenueChartConfig,
} from "@admin/components/dash/tokens"
import {
  DASHBOARD_CHART_RANGE_OPTIONS,
  mapAppointmentPoints,
  type AppointmentChartPoint,
  type RevenueChartPoint,
} from "@admin/api/dashboard/charts"
import { DashboardEmptyState } from "@admin/components/dash/states"

function useChartMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

function angledLabels(range: string, count: number) {
  return range === "monthly" || range === "yearly" || count > 12
}

/** Recharts XAxis tick props — angle is valid at runtime but not in SVGTextElement types. */
function chartXAxisTick(tilt: boolean) {
  return (
    tilt
      ? { fontSize: 9, fill: DASH.tickFill, angle: -45, textAnchor: "end" as const }
      : { fontSize: 11, fill: DASH.tickFill }
  )
}

export function RevenueChart() {
  const mounted = useChartMounted()
  const {
    range,
    setRange,
    points,
    loading,
    refreshing,
    error,
    retry,
  } = useDashboardChart<RevenueChartPoint>({ metric: "revenue" })

  const showBrush = points.length > 8
  const tiltLabels = angledLabels(range, points.length)

  if (!mounted) {
    return <ChartCard title="Revenue Trend" icon={TrendingUp} height={280}><div /></ChartCard>
  }

  return (
    <ChartCard
      title="Revenue Trend"
      subtitle="Server-filtered revenue by period"
      icon={TrendingUp}
      height={showBrush ? 300 : 280}
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
        <DashboardEmptyState title="No revenue data" className="py-16" />
      ) : (
        <ChartContainer config={revenueChartConfig} className="h-full w-full min-h-[220px] aspect-auto">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: showBrush ? 24 : 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={DASH.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DASH.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DASH.gridStroke} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              height={tiltLabels ? 48 : 30}
              tick={chartXAxisTick(tiltLabels)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: DASH.tickFill }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={42}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(Number(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={DASH.primary}
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              dot={{ r: 3, fill: DASH.primary, strokeWidth: 2, stroke: "white" }}
              activeDot={{ r: 5, fill: DASH.primary }}
            />
            {showBrush && (
              <Brush
                dataKey="date"
                height={20}
                stroke={DASH.primary}
                fill="#f0f4ff"
                travellerWidth={8}
                tickFormatter={(_, index) => points[index]?.label ?? ""}
              />
            )}
          </AreaChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}

export function AppointmentChart() {
  const mounted = useChartMounted()
  const {
    range,
    setRange,
    points,
    loading,
    refreshing,
    error,
    retry,
  } = useDashboardChart<AppointmentChartPoint>({
    metric: "appointments",
    mapPoints: mapAppointmentPoints,
  })

  const showBrush = points.length > 10
  const tiltLabels = angledLabels(range, points.length)

  if (!mounted) {
    return <ChartCard title="Appointment Trends" icon={CalendarDays} height={280}><div /></ChartCard>
  }

  return (
    <ChartCard
      title="Appointment Trends"
      subtitle="Server-filtered booking volume"
      icon={CalendarDays}
      height={showBrush ? 300 : 280}
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
        <DashboardEmptyState title="No appointment data" className="py-16" />
      ) : (
        <ChartContainer config={appointmentsChartConfig} className="h-full w-full min-h-[220px] aspect-auto">
          <BarChart
            data={points}
            barSize={range === "weekly" ? 28 : 10}
            margin={{ top: 8, right: 8, left: 0, bottom: showBrush ? 24 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DASH.gridStroke} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              height={tiltLabels ? 48 : 30}
              tick={chartXAxisTick(tiltLabels)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: DASH.tickFill }}
              allowDecimals={false}
              width={32}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="appointments"
              fill="var(--color-appointments)"
              radius={[6, 6, 0, 0]}
            />
            {showBrush && (
              <Brush
                dataKey="date"
                height={20}
                stroke={DASH.primary}
                fill="#f0f4ff"
                travellerWidth={8}
                tickFormatter={(_, index) => points[index]?.label ?? ""}
              />
            )}
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}
