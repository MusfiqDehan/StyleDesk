"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getDashboardChart,
  UI_TO_API_RANGE,
  type DashboardChartMetric,
  type DashboardChartUiRange,
} from "@admin/api/dashboard/charts"

interface UseDashboardChartOptions<T> {
  metric: DashboardChartMetric
  initialRange?: DashboardChartUiRange
  mapPoints?: (raw: T[]) => T[]
  enabled?: boolean
}

export function useDashboardChart<T>({
  metric,
  initialRange = "weekly",
  mapPoints,
  enabled = true,
}: UseDashboardChartOptions<T>) {
  const [range, setRange] = useState<DashboardChartUiRange>(initialRange)
  const [points, setPoints] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const load = useCallback(
    async (selectedRange: DashboardChartUiRange, isInitial = false) => {
      if (!enabled) return
      const id = ++request.current

      if (isInitial) setLoading(true)
      else setRefreshing(true)

      try {
        const apiRange = UI_TO_API_RANGE[selectedRange]
        const response = await getDashboardChart<T>(metric, apiRange)
        if (id !== request.current) return
        const next = mapPoints ? mapPoints(response.points) : response.points
        setPoints(next)
        setError(null)
      } catch (err: unknown) {
        if (id !== request.current) return
        const message =
          err instanceof Error ? err.message : "Failed to load chart data"
        setError(message)
      } finally {
        if (id === request.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [enabled, metric, mapPoints],
  )

  useEffect(() => {
    if (!enabled) return
    void load(range, points.length === 0)
    return () => { request.current++ }
    // points.length intentionally omitted — only used to pick initial vs refresh skeleton
  }, [range, load, enabled])

  const retry = useCallback(() => {
    void load(range, false)
  }, [load, range])

  return {
    range,
    setRange,
    points,
    loading,
    refreshing,
    error,
    retry,
  }
}
