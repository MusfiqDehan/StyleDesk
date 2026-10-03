"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Clock } from "lucide-react"

const HOUR_DIAL_LABELS = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]
const ANALOG_TICKS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

type AmPm = "AM" | "PM"

function normalizeTimeWithSeconds(value: string) {
  if (!value) return ""
  const parts = value.split(":")
  if (parts.length === 2) return `${value}:00`
  return value
}

function toTimeSeconds(value: string) {
  const [hour = "0", minute = "0", second = "0"] = normalizeTimeWithSeconds(value).split(":")
  return (Number.parseInt(hour, 10) || 0) * 3600 + (Number.parseInt(minute, 10) || 0) * 60 + (Number.parseInt(second, 10) || 0)
}

export function parseTimeValue(value: string) {
  const [hour = "", minute = ""] = normalizeTimeWithSeconds(value).split(":")
  return { hour: hour.padStart(2, "0"), minute: minute.padStart(2, "0") }
}

export function formatTimePickerLabel(value: string) {
  if (!value) return "Select time"
  const { hour, minute } = parseTimeValue(value)
  const hh = Number.parseInt(hour, 10) || 0
  const twelveHour = hh % 12 || 12
  const ampm = hh >= 12 ? "PM" : "AM"
  return `${String(twelveHour).padStart(2, "0")}:${minute} ${ampm}`
}

function periodFromHour(hour: string): AmPm {
  return (Number.parseInt(hour, 10) || 0) >= 12 ? "PM" : "AM"
}

/** Map a 12-hour dial label + AM/PM to a 24-hour "HH" string. */
function hourTo24(dialLabel: string, period: AmPm): string {
  let h = Number.parseInt(dialLabel, 10)
  if (Number.isNaN(h)) h = 12
  if (period === "AM") {
    if (h === 12) h = 0
  } else if (h !== 12) {
    h += 12
  }
  return String(h).padStart(2, "0")
}

function isTimeWithinBounds(time: string, minTime?: string, maxTime?: string) {
  const s = toTimeSeconds(time)
  if (minTime && s < toTimeSeconds(minTime)) return false
  if (maxTime && s > toTimeSeconds(maxTime)) return false
  return true
}

function isHourSelectable(hour: string, minTime?: string, maxTime?: string) {
  if (!minTime && !maxTime) return true
  if (minTime && toTimeSeconds(`${hour}:59:59`) < toTimeSeconds(minTime)) return false
  if (maxTime && toTimeSeconds(`${hour}:00:00`) > toTimeSeconds(maxTime)) return false
  return true
}

function getDialLabelFromHour(hour: string) {
  const parsed = Number.parseInt(hour, 10)
  if (Number.isNaN(parsed)) return null
  return String(parsed % 12 || 12).padStart(2, "0")
}

/** Build dial label → 24h hour map for the active AM/PM period. */
function buildDialHourMap(period: AmPm, minTime?: string, maxTime?: string): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = Object.fromEntries(HOUR_DIAL_LABELS.map((l) => [l, undefined]))
  for (const label of HOUR_DIAL_LABELS) {
    const hour24 = hourTo24(label, period)
    if (!isHourSelectable(hour24, minTime, maxTime)) continue
    result[label] = hour24
  }
  return result
}

function isPeriodAvailable(period: AmPm, minTime?: string, maxTime?: string) {
  return HOUR_DIAL_LABELS.some((label) => isHourSelectable(hourTo24(label, period), minTime, maxTime))
}

function AnalogClockDial({
  values,
  selected,
  onSelect,
  isDisabled,
  title,
}: {
  values: string[]
  selected: string
  onSelect: (value: string) => void
  isDisabled?: (value: string) => boolean
  title: string
}) {
  const center = 128
  const radius = 100
  const selectedIndex = values.indexOf(selected)
  const handRotation = selectedIndex >= 0 ? selectedIndex * 30 : 0

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="relative mx-auto h-64 w-64 rounded-full border border-border/70 bg-gradient-to-b from-background to-muted/30 shadow-inner">
        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 256 256" aria-hidden="true">
          <line
            x1="128" y1="128" x2="128" y2="42"
            stroke="currentColor" strokeWidth="2"
            className="text-primary/80"
            transform={`rotate(${handRotation} 128 128)`}
          />
        </svg>
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        {values.map((value, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180)
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)
          const disabled = isDisabled?.(value) ?? false
          const active = value === selected
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(value)}
              className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border text-xs font-semibold transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"
              } ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AmPmToggle({
  value,
  onChange,
  minTime,
  maxTime,
}: {
  value: AmPm
  onChange: (period: AmPm) => void
  minTime?: string
  maxTime?: string
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="AM or PM">
      {(["AM", "PM"] as const).map((period) => {
        const available = isPeriodAvailable(period, minTime, maxTime)
        const active = value === period
        return (
          <button
            key={period}
            type="button"
            disabled={!available}
            onClick={() => onChange(period)}
            className={`min-w-[3rem] rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${!available ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
          >
            {period}
          </button>
        )
      })}
    </div>
  )
}

export function ClockPickerField({
  value,
  onChange,
  minTime,
  maxTime,
  placeholder = "Select time",
}: {
  value: string
  onChange: (value: string) => void
  minTime?: string
  maxTime?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"hour" | "minute">("hour")
  const [draftHour, setDraftHour] = useState("09")
  const [draftMinute, setDraftMinute] = useState("00")
  const [draftPeriod, setDraftPeriod] = useState<AmPm>("AM")

  const dialHourMap = useMemo(
    () => buildDialHourMap(draftPeriod, minTime, maxTime),
    [draftPeriod, minTime, maxTime],
  )

  useEffect(() => {
    if (!open) return
    const parts = parseTimeValue(value)
    const period = parts.hour ? periodFromHour(parts.hour) : "AM"
    const map = buildDialHourMap(period, minTime, maxTime)
    const firstAvailable = Object.values(map).find(Boolean) ?? hourTo24("09", period)
    const normalizedHour = Object.values(map).includes(parts.hour) ? parts.hour : firstAvailable
    setDraftPeriod(period)
    setDraftHour(normalizedHour)
    setDraftMinute(parts.minute || "00")
    setStep("hour")
  }, [open, value, minTime, maxTime])

  const handlePeriodChange = (period: AmPm) => {
    if (period === draftPeriod) return
    const label = getDialLabelFromHour(draftHour) ?? "09"
    const nextHour = hourTo24(label, period)
    if (!isHourSelectable(nextHour, minTime, maxTime)) {
      // Fall back to first available hour in the new period
      const map = buildDialHourMap(period, minTime, maxTime)
      const fallback = Object.values(map).find(Boolean)
      if (!fallback) return
      setDraftPeriod(period)
      setDraftHour(fallback)
      return
    }
    setDraftPeriod(period)
    setDraftHour(nextHour)
  }

  const handleHourSelect = (hourLabel: string) => {
    const mapped = dialHourMap[hourLabel]
    if (!mapped) return
    setDraftHour(mapped)
    setDraftMinute(parseTimeValue(value).minute || draftMinute || "00")
    setStep("minute")
  }

  const handleMinuteSelect = (minute: string) => {
    onChange(`${draftHour}:${minute}`)
    setOpen(false)
    setStep("hour")
  }

  const displayLabel = value ? formatTimePickerLabel(value) : placeholder
  const previewLabel = formatTimePickerLabel(`${draftHour}:${draftMinute}:00`)
  const selectedDialLabel = getDialLabelFromHour(draftHour) ?? "09"
  const windowLabel =
    minTime && maxTime
      ? `${formatTimePickerLabel(minTime)} – ${formatTimePickerLabel(maxTime)}`
      : "Pick hour, then minute"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal">
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 shadow-xl overflow-hidden" align="start">
        <div className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-transparent px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.22em] text-primary/70 uppercase">Clock Picker</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {step === "hour" ? "Choose an hour" : "Choose minutes"}
              </p>
              <p className="text-xs text-muted-foreground">{windowLabel}</p>
            </div>
            <AmPmToggle
              value={draftPeriod}
              onChange={handlePeriodChange}
              minTime={minTime}
              maxTime={maxTime}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Selected</span>
            <div className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm">
              {previewLabel}
            </div>
          </div>
        </div>
        {step === "hour" ? (
          <div className="p-4">
            <AnalogClockDial
              title={`Hours (${draftPeriod})`}
              values={HOUR_DIAL_LABELS}
              selected={selectedDialLabel}
              onSelect={handleHourSelect}
              isDisabled={(label) => {
                const mapped = dialHourMap[label]
                if (!mapped) return true
                return !isHourSelectable(mapped, minTime, maxTime)
              }}
            />
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={() => setStep("hour")}
              >
                Back to hours
              </Button>
            </div>
            <AnalogClockDial
              title="Minutes"
              values={ANALOG_TICKS}
              selected={draftMinute}
              onSelect={handleMinuteSelect}
              isDisabled={(minute) => !isTimeWithinBounds(`${draftHour}:${minute}:00`, minTime, maxTime)}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
