"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { formatCurrency, formatMoney } from "@/lib/utils"
import { ChartCard } from "./chart-card"
import {
  buildSeriesChartConfig,
  CHART_PALETTE,
  DASH,
  PAYMENT_METHOD_COLORS,
  SOURCE_COLORS,
  STATUS_COLORS,
} from "./tokens"

interface PaymentChartProps {
  data: { name: string; revenue: number }[]
}

interface TopServicesPieProps {
  services: { name: string; count: number }[]
}

interface SourceChartProps {
  data: { name: string; count: number }[]
  onlineGrowth?: number
}

interface StatusChartProps {
  data: { name: string; count: number }[]
}

interface StaffRevenueChartProps {
  data: { name: string; revenue: number }[]
}

export function PaymentMethodChart({ data }: PaymentChartProps) {
  const config = useMemo(
    () => buildSeriesChartConfig(data.map((d) => d.name)),
    [data],
  )

  return (
    <ChartCard title="Payment Method" subtitle="Revenue by payment type" height={300}>
      <ChartContainer config={config} className="h-full w-full min-h-[240px] aspect-auto">
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DASH.gridStroke} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: DASH.tickFill, fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: DASH.tickFill }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(v))}
            width={48}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `BDT ${formatMoney(Number(value))}`}
              />
            }
          />
          <Bar dataKey="revenue" radius={[8, 8, 0, 0]} barSize={48}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={PAYMENT_METHOD_COLORS[entry.name] ?? CHART_PALETTE[0]}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function TopServicesPieChart({ services }: TopServicesPieProps) {
  const slice = services.slice(0, 6)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const visibleData = slice.filter((s) => !hidden.has(s.name))
  const config = useMemo(
    () => buildSeriesChartConfig(slice.map((s) => s.name)),
    [slice],
  )

  const toggleSeries = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <ChartCard
      title="Top Services"
      subtitle="Click legend to toggle series"
      height={340}
    >
      <ChartContainer config={config} className="h-full w-full min-h-[280px] aspect-auto">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={visibleData}
            cx="50%"
            cy="45%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={3}
            dataKey="count"
            nameKey="name"
            stroke="none"
          >
            {visibleData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {slice.map((s, i) => {
          const isHidden = hidden.has(s.name)
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggleSeries(s.name)}
              aria-pressed={!isHidden}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-opacity ${
                isHidden ? "opacity-40" : "opacity-100"
              } border-[var(--brand-line)] bg-white text-[var(--brand-muted)] hover:border-[#0076E9]/30`}
            >
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                aria-hidden
              />
              {s.name} ({s.count})
            </button>
          )
        })}
      </div>
    </ChartCard>
  )
}

export function AppointmentsBySourceChart({ data, onlineGrowth = 0 }: SourceChartProps) {
  const config = useMemo(
    () => buildSeriesChartConfig(data.map((d) => d.name)),
    [data],
  )

  return (
    <ChartCard
      title="Appointments by Source"
      subtitle={`Online booking ${onlineGrowth >= 0 ? "+" : ""}${onlineGrowth}% growth`}
      height={300}
    >
      <ChartContainer config={config} className="h-full w-full min-h-[240px] aspect-auto">
        <BarChart data={data} barGap={12} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: DASH.tickFill, fontWeight: 500 }}
          />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={80}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={SOURCE_COLORS[entry.name] ?? CHART_PALETTE[0]}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function AppointmentsByStatusChart({ data }: StatusChartProps) {
  const config = useMemo(
    () => buildSeriesChartConfig(data.map((d) => d.name)),
    [data],
  )

  return (
    <ChartCard title="Appointments by Status" subtitle="Pipeline breakdown" height={300}>
      <ChartContainer config={config} className="h-full w-full min-h-[240px] aspect-auto">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DASH.gridStroke} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: DASH.tickFill }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: DASH.tickFill }}
            width={32}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={STATUS_COLORS[entry.name] ?? CHART_PALETTE[0]}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function StaffRevenueChart({ data }: StaffRevenueChartProps) {
  const config = useMemo(
    () => ({ revenue: { label: "Revenue", color: "#29b6f6" } }),
    [],
  )

  if (data.length === 0) return null

  return (
    <ChartCard title="Staff Revenue" subtitle="Top performers by revenue" height={300}>
      <ChartContainer config={config} className="h-full w-full min-h-[240px] aspect-auto">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DASH.gridStroke} />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: DASH.tickFill }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
            width={100}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
            }
          />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 6, 6, 0]} barSize={22} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
