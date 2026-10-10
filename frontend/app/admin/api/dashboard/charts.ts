import api from "../base"
import { CACHE, consumeStale } from "@admin/lib/cache"

const TTL = 2 * 60 * 1000

export type DashboardChartRange = "week" | "month" | "6m" | "year"

/** Values used by RangeToggle on overview dashboards */
export type DashboardChartUiRange = "weekly" | "monthly" | "6months" | "yearly"

export const UI_TO_API_RANGE: Record<DashboardChartUiRange, DashboardChartRange> = {
  weekly: "week",
  monthly: "month",
  "6months": "6m",
  yearly: "year",
}

export const DASHBOARD_CHART_RANGE_OPTIONS: { value: DashboardChartUiRange; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "6months", label: "6 Mo" },
  { value: "yearly", label: "Year" },
]

export interface DashboardChartResponse<T> {
  metric: string
  range: DashboardChartRange
  granularity: string
  timezone: string
  points: T[]
}

export interface RevenueChartPoint {
  label: string
  date: string
  revenue: number
}

export interface AppointmentChartPoint {
  label: string
  date: string
  appointments: number
}

export interface TopServiceChartPoint {
  name: string
  count: number
}

export interface FinanceChartPoint {
  label: string
  date: string
  income: number
  expense: number
  paid: number
  due: number
}

export type DashboardChartMetric = "revenue" | "appointments" | "top-services" | "finance"

function normalizePoints<T>(data: unknown): T[] {
  if (!data || typeof data !== "object") return []
  const body = data as Record<string, unknown>
  if (Array.isArray(body.points)) return body.points as T[]
  if (Array.isArray(body.services)) return body.services as T[]
  return []
}

export async function getDashboardChart<T>(
  metric: DashboardChartMetric,
  range: DashboardChartRange,
  noCache = false,
): Promise<DashboardChartResponse<T>> {
  const override = noCache || consumeStale(CACHE.DASHBOARD)
  const cacheId = `${CACHE.DASHBOARD}-chart-${metric}-${range}`

  const { data } = await api.get(`${typeof window!=='undefined'&&window.location.pathname.startsWith('/admin/manager')?'/manager-dashboard':'/dashboard'}/charts/${metric}`, {
    params: { range },
    id: cacheId,
    cache: noCache ? false : { ttl: TTL, override },
  })

  const response = data as DashboardChartResponse<T>
  return {
    ...response,
    points: normalizePoints<T>(data),
  }
}

export function mapAppointmentPoints(
  raw: Array<{ label: string; date: string; appointments?: number; count?: number }>,
): AppointmentChartPoint[] {
  return raw.map((p) => ({
    label: p.label,
    date: p.date,
    appointments: Number(p.appointments ?? p.count ?? 0),
  }))
}

export function mapFinancePoints(
  raw: Array<Partial<FinanceChartPoint> & { label: string; date: string }>,
): FinanceChartPoint[] {
  return raw.map((p) => ({
    label: p.label,
    date: p.date,
    income: Number(p.income ?? 0),
    expense: Number(p.expense ?? 0),
    paid: Number(p.paid ?? 0),
    due: Number(p.due ?? 0),
  }))
}
