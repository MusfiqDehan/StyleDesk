import type { ChartConfig } from "@/components/ui/chart"

/** StyleDesk admin dashboard design tokens */
export const DASH = {
  pageBg: "bg-brand-mist",
  cardBg: "bg-card",
  cardBorder: "border-[var(--brand-line)]",
  cardRadius: "rounded-lg",
  primary: "#7040c1",
  primaryHover: "#5c34a8",
  textPrimary: "text-[var(--brand-ink)]",
  textSecondary: "text-[var(--brand-muted)]",
  textMuted: "text-[#94a3b8]",
  gridStroke: "var(--brand-soft)",
  tickFill: "#94a3b8",
} as const

export const CHART_PALETTE = [
  "#7040c1",
  "#9b7ad8",
  "#7e57c2",
  "#26a69a",
  "#ffa000",
  "#ec407a",
  "#6366f1",
  "#22c55e",
] as const

export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  Cash: "#ffb74d",
  bKash: "#d81b60",
  Card: "#2196f3",
}

export const SOURCE_COLORS: Record<string, string> = {
  "Walk-In": "#6366f1",
  Online: "#818cf8",
  Call: "#0ea5e9",
}

export const STATUS_COLORS: Record<string, string> = {
  Pending: "#ffc107",
  Confirmed: "#00c2ab",
  Completed: "#00a676",
  "Checked In": "#66bb6a",
  "In Service": "#9575cd",
}

export const revenueChartConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: DASH.primary,
  },
}

export const appointmentsChartConfig: ChartConfig = {
  appointments: {
    label: "Appointments",
    color: DASH.primary,
  },
}

export const financeChartConfig: ChartConfig = {
  income: {
    label: "Income",
    color: "#27b85e",
  },
  expense: {
    label: "Expense",
    color: "#ef4444",
  },
}

export function buildSeriesChartConfig(
  keys: string[],
  labels?: Record<string, string>,
): ChartConfig {
  return keys.reduce<ChartConfig>((acc, key, i) => {
    acc[key] = {
      label: labels?.[key] ?? key,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }
    return acc
  }, {})
}
