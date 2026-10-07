"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react"
import { createPortal } from "react-dom"
import { useDebounce } from "@/hooks/use-debounce"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { useAuth } from "@admin/hooks/use-auth"
import { hasPermission } from "@admin/lib/auth-utils"
import { formatCurrency, formatMoney, cn } from "@/lib/utils"
import { AdminPageHeader, AdminHeaderPrimaryButton, AdminHeaderSecondaryButton, AdminHeaderDangerButton } from "@admin/components/admin-page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Calendar as CalendarIcon, Clock, MoreHorizontal, Upload, Download, ChevronDown, Pencil, Trash2, User, Phone, Scissors, UserCheck, Zap, Check, Percent, X, MapPin } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { getAppointments, createAppointment, updateAppointment, deleteAppointment } from "@admin/api/appointments/appointments"
import { getClients } from "@admin/api/clients/clients"
import { getActiveServices } from "@admin/api/services/services"
import { getPackages } from "@admin/api/packages/packages"
import { getStylists } from "@admin/api/employees/employees"
import { getAppointmentSettings, getInvoiceSettings } from "@admin/api/settings/settings"
import { clearCacheByPrefix, markStale, CACHE } from "@admin/lib/cache"
import {
  UNREAD_BOOKINGS_EVENT,
  loadUnreadBookingIds,
  markBookingRead as persistMarkBookingRead,
  markBookingUnread as persistMarkBookingUnread,
  pruneUnreadBookingIds,
} from "@admin/lib/booking-unread"
import { getSocketConnection } from "@admin/lib/socket"
import { toast } from '@/lib/toast'
import {
  BookingKpiCards,
  appointmentMatchesTimeFilter,
  type BookingKpiKey,
} from "@admin/components/booking-kpi-cards"

interface AppointmentRecord {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  time: string
  staff: string | null
  services: string[] | null
  source: string
  status: string
  isPackage?: boolean
  packageName?: string
  advance?: number
  discount?: number
  dueAmount?: number
  totalAmount?: number
  /** Tax % snapshotted when the booking was created (null = legacy). */
  taxRate?: number | null
  inTime?: string | null
  outTime?: string | null
  /** When the customer submitted the booking request. */
  createdAt?: string | null
}

interface ClientOption {
  id: string
  name: string
  phone: string
}

type AppointmentStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled"
type AppointmentSource = "Online" | "Walk In" | "Call"

interface Appointment {
  id: string
  client: string
  phone: string
  service: string
  employee: string
  date: string
  /** Always stored as 24-hour "HH:MM" for form inputs */
  time: string
  status: AppointmentStatus
  source: AppointmentSource
  isPackage: boolean
  packageName: string
  advance: number
  discount: number
  dueAmount: number
  totalAmount: number
  /** Tax % at booking time; null for legacy rows without a snapshot. */
  taxRate: number | null
  /** Always stored as 24-hour "HH:MM" for form inputs */
  inTime: string
  outTime: string
  /** When the customer submitted the booking request (ISO). */
  createdAt: string
}

const statusOptions: AppointmentStatus[] = ["Pending", "Confirmed", "Cancelled"]

/** CSS zoom on <html> breaks Radix floating UI — correct fixed coords by app scale. */
function getAppZoom() {
  if (typeof document === "undefined") return 1
  const fromData = Number(document.documentElement.dataset.appScale)
  if (Number.isFinite(fromData) && fromData > 0) return fromData
  const fromVar = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-scale"),
  )
  if (Number.isFinite(fromVar) && fromVar > 0) return fromVar
  const fromZoom = Number.parseFloat(document.documentElement.style.zoom)
  if (Number.isFinite(fromZoom) && fromZoom > 0) return fromZoom
  return 1
}

function BookingStatusDropdown({
  status,
  disabled,
  buttonClassName,
  dotClassName,
  itemClassName,
  onChange,
}: {
  status: AppointmentStatus
  disabled?: boolean
  buttonClassName: (s: AppointmentStatus | string) => string
  dotClassName: (s: AppointmentStatus | string) => string
  itemClassName: (s: AppointmentStatus | string) => string
  onChange: (next: AppointmentStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const updatePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const zoom = getAppZoom()
    setPos({
      top: (rect.bottom + 6) / zoom,
      left: rect.left / zoom,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onReposition = () => updatePos()
    window.addEventListener("scroll", onReposition, true)
    window.addEventListener("resize", onReposition)
    document.addEventListener("mousedown", onPointer)
    return () => {
      window.removeEventListener("scroll", onReposition, true)
      window.removeEventListener("resize", onReposition)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open, updatePos])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 w-[108px] items-center justify-between gap-1 overflow-hidden rounded-full border px-2 text-[11px] font-semibold outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
          buttonClassName(status),
        )}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName(status))} />
          <span className="min-w-0 truncate">{status}</span>
        </span>
        <ChevronDown className="size-3 shrink-0 opacity-70" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 200 }}
            className="min-w-[160px] rounded-xl border border-[#e7e7e7] bg-white p-1 shadow-lg"
          >
            {statusOptions.map((option) => {
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === status}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium",
                    itemClassName(option),
                    option === status && "bg-brand-mist",
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    if (option !== status) onChange(option)
                  }}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", dotClassName(option))} />
                  {option}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
const timeFilterOptions = ["All Time", "Today", "This Week", "This Month", "Last 6 Months", "This Year", "Custom Date"]
const PAGE_SIZE = 10

/** Convert any server time value to 24h "HH:MM" for <input type="time"> */
function toInputTime(t: string): string {
  if (!t) return ""
  // "HH:MM AM/PM" format
  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1])
    const m = ampmMatch[2]
    const ampm = ampmMatch[3].toUpperCase()
    if (ampm === "PM" && h !== 12) h += 12
    if (ampm === "AM" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${m}`
  }
  // "HH:MM:SS" or "HH:MM"
  return t.substring(0, 5)
}

/** Display time as "H:MM AM/PM" in the table */
function formatTimeDisplay(t: string): string {
  if (!t) return ""
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr)
  const m = mStr ?? "00"
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatDateDisplay(dateValue: string): string {
  if (!dateValue) return "Select date"
  const parsed = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? dateValue : format(parsed, "PPP")
}

/** Always renders in Asia/Dhaka — Order Time is a salon business timestamp. */
function formatRequestTime(value?: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed
    .toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
}

function requestTimeMs(value?: string | null): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

const HOUR_DIAL_LABELS = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]
const ANALOG_TICKS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

function toTimeSeconds(value: string) {
  const [hour = "0", minute = "0", second = "0"] = value.split(":")
  const hh = Number.parseInt(hour, 10) || 0
  const mm = Number.parseInt(minute, 10) || 0
  const ss = Number.parseInt(second, 10) || 0
  return hh * 3600 + mm * 60 + ss
}

function parseTimeValue(value: string) {
  const [hour = "", minute = "", second = ""] = value.split(":")
  return {
    hour: hour.padStart(2, "0"),
    minute: minute.padStart(2, "0"),
    second: second.padStart(2, "0"),
  }
}

function formatTimePickerLabel(value: string): string {
  if (!value) return "Select time"
  const { hour, minute } = parseTimeValue(value)
  const hh = Number.parseInt(hour, 10) || 0
  const twelveHour = hh % 12 || 12
  const ampm = hh >= 12 ? "PM" : "AM"
  return `${String(twelveHour).padStart(2, "0")}:${minute} ${ampm}`
}

function normalizeTimeWithSeconds(value: string) {
  if (!value) return ""
  const parts = value.split(":")
  if (parts.length === 2) return `${value}:00`
  return value
}

function isTimeWithinBounds(time: string, minTime?: string, maxTime?: string) {
  const currentSeconds = toTimeSeconds(time)
  if (minTime && currentSeconds < toTimeSeconds(normalizeTimeWithSeconds(minTime))) return false
  if (maxTime && currentSeconds > toTimeSeconds(normalizeTimeWithSeconds(maxTime))) return false
  return true
}

function isHourSelectable(hour: string, minTime?: string, maxTime?: string) {
  if (!minTime && !maxTime) return true
  const earliestMinute = `${hour}:00:00`
  const latestMinute = `${hour}:59:59`
  if (minTime && toTimeSeconds(latestMinute) < toTimeSeconds(normalizeTimeWithSeconds(minTime))) return false
  if (maxTime && toTimeSeconds(earliestMinute) > toTimeSeconds(normalizeTimeWithSeconds(maxTime))) return false
  return true
}

function getDialLabelFromHour(hour: string) {
  const parsedHour = Number.parseInt(hour, 10)
  if (Number.isNaN(parsedHour)) return null
  const twelveHour = parsedHour % 12 || 12
  return String(twelveHour).padStart(2, "0")
}

function buildDialHourMap(minTime?: string, maxTime?: string) {
  const result: Record<string, string | undefined> = {
    "12": undefined,
    "01": undefined,
    "02": undefined,
    "03": undefined,
    "04": undefined,
    "05": undefined,
    "06": undefined,
    "07": undefined,
    "08": undefined,
    "09": undefined,
    "10": undefined,
    "11": undefined,
  }

  for (let h = 0; h < 24; h++) {
    const hour = String(h).padStart(2, "0")
    if (!isHourSelectable(hour, minTime, maxTime)) continue
    const dialLabel = getDialLabelFromHour(hour)
    if (!dialLabel) continue
    if (!result[dialLabel]) {
      result[dialLabel] = hour
    }
  }

  return result
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
            x1="128"
            y1="128"
            x2="128"
            y2="42"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary/80"
            transform={`rotate(${handRotation} 128 128)`}
          />
        </svg>
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        {values.map((value, index) => {
          const angle = ((index * 30) - 90) * (Math.PI / 180)
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
              className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border text-xs font-semibold transition-all ${active
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

function ClockPickerField({
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
  const dialHourMap = useMemo(() => buildDialHourMap(minTime, maxTime), [minTime, maxTime])

  useEffect(() => {
    if (!open) return
    const parts = parseTimeValue(value)
    const firstAvailableHour = Object.values(dialHourMap).find((hour) => Boolean(hour)) ?? "09"
    const normalizedHour = Object.values(dialHourMap).includes(parts.hour) ? parts.hour : firstAvailableHour
    setDraftHour(normalizedHour)
    setDraftMinute(parts.minute || "00")
    setStep("hour")
  }, [open, value, dialHourMap])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStep("hour")
    }
  }

  const handleHourSelect = (hourLabel: string) => {
    const mappedHour = dialHourMap[hourLabel]
    if (!mappedHour) return
    setDraftHour(mappedHour)
    const parts = parseTimeValue(value)
    setDraftMinute(parts.minute || "00")
    setStep("minute")
  }

  const handleMinuteSelect = (minute: string) => {
    setDraftMinute(minute)
    const nextTime = `${draftHour}:${minute}:00`
    onChange(nextTime)
    setOpen(false)
    setStep("hour")
  }

  const displayLabel = value ? formatTimePickerLabel(value) : placeholder
  const previewLabel = formatTimePickerLabel(`${draftHour}:${draftMinute}:00`)
  const selectedDialLabel = getDialLabelFromHour(draftHour) ?? "09"
  const serviceWindowLabel =
    minTime && maxTime
      ? `${formatTimePickerLabel(normalizeTimeWithSeconds(minTime))} - ${formatTimePickerLabel(normalizeTimeWithSeconds(maxTime))}`
      : "Use settings to define opening and closing hours."

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start px-3 font-normal"
        >
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {displayLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 shadow-xl overflow-hidden" align="start">
        <div className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-transparent px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.22em] text-primary/70 uppercase">
            Clock Picker
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {step === "hour" ? "Choose an hour" : "Choose minutes"}
              </p>
              <p className="text-xs text-muted-foreground">
                Service hours are limited to {serviceWindowLabel}.
              </p>
            </div>
          </div>
        </div>

        {step === "hour" ? (
          <div className="p-4">
            <AnalogClockDial
              title="Hours"
              values={HOUR_DIAL_LABELS}
              selected={selectedDialLabel}
              onSelect={handleHourSelect}
              isDisabled={(hourLabel) => {
                const mappedHour = dialHourMap[hourLabel]
                if (!mappedHour) return true
                return !isHourSelectable(mappedHour, minTime, maxTime)
              }}
            />
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={() => setStep("hour")}
              >
                Back to hours
              </Button>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm">
                  {previewLabel}
                </div>
              </div>
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

function normalizeSource(raw: string): AppointmentSource {
  const s = (raw ?? "").toLowerCase().replace(/[-_]/g, " ").trim()
  if (s === "walk in" || s === "walkin") return "Walk In"
  if (s === "call") return "Call"
  return "Online"
}

function escapeCsvValue(value: string | null | undefined): string {
  const safeValue = (value ?? "").toString()
  const escapedValue = safeValue.replace(/"/g, '""')
  if (/[",\n]/.test(escapedValue)) {
    return `"${escapedValue}"`
  }
  return escapedValue
}



function toUIAppointment(r: AppointmentRecord): Appointment {
  const servicesRaw = r.services
  const serviceLabel = Array.isArray(servicesRaw)
    ? servicesRaw.map((s) => String(s || "").trim()).filter(Boolean).join(", ")
    : String(servicesRaw || "").trim()

  return {
    id: r.id,
    client: r.clientName,
    phone: r.phoneNumber,
    service: serviceLabel,
    employee: r.staff ?? "",
    date: r.date,
    time: toInputTime(r.time),
    status: r.status as AppointmentStatus,
    source: normalizeSource(r.source),
    isPackage: r.isPackage || false,
    packageName: r.packageName || "",
    advance: Number(r.advance ?? 0),
    discount: Number(r.discount ?? 0),
    dueAmount: Number(r.dueAmount ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    taxRate:
      r.taxRate != null && Number.isFinite(Number(r.taxRate))
        ? Number(r.taxRate)
        : null,
    inTime: toInputTime(r.inTime ?? ""),
    outTime: toInputTime(r.outTime ?? ""),
    createdAt: r.createdAt ? String(r.createdAt) : "",
  }
}

function splitLabelNames(value?: string | null) {
  if (!value) return [] as string[]
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

function formatPackageLabel(apt: Appointment) {
  const names = splitLabelNames(apt.packageName)
  return names.length > 0 ? names.join(", ") : "—"
}

function formatServiceLabel(
  apt: Appointment,
  serviceOptions?: { name: string }[],
  packageOptions?: { name: string; features?: string[] }[],
) {
  const billable = getBillableServiceNames(
    splitLabelNames(apt.service),
    apt,
    packageOptions,
    serviceOptions,
  )
  return billable.length > 0 ? billable.join(", ") : "—"
}

type ConfirmAmountMode = "percentage" | "flat"

/** Round tax up to next whole unit whenever there is any fraction (e.g. 12006.83 → 12007). */
function ceilTaxAmount(subtotal: number, taxRate: number) {
  const rate = Number(taxRate || 0)
  if (!Number.isFinite(rate) || rate <= 0 || subtotal <= 0) return 0
  return Math.ceil((subtotal * rate) / 100)
}

/**
 * Tax for an existing booking uses the rate snapshotted at create time.
 * Settings rate changes only apply to new bookings / drafts without a snapshot.
 */
function resolveBookingTax(
  apt: Pick<Appointment, "totalAmount" | "taxRate">,
  subtotal: number,
  currentSettingsRate: number,
) {
  const storedTotal = Number(apt.totalAmount ?? 0)
  const snap =
    apt.taxRate != null && Number.isFinite(Number(apt.taxRate))
      ? Number(apt.taxRate)
      : null

  if (snap != null) {
    const tax = ceilTaxAmount(subtotal, snap)
    return {
      rate: snap,
      tax,
      total: subtotal > 0 ? subtotal + tax : storedTotal,
    }
  }

  // Legacy bookings (no snapshot): keep stored total; derive tax from it
  if (storedTotal > 0 && subtotal > 0) {
    const tax = Math.max(0, Math.round((storedTotal - subtotal) * 100) / 100)
    const inferred =
      subtotal > 0 && tax > 0
        ? Math.round((tax / subtotal) * 1000) / 10
        : 0
    return { rate: inferred, tax, total: storedTotal }
  }

  const tax = ceilTaxAmount(subtotal, currentSettingsRate)
  return {
    rate: currentSettingsRate,
    tax,
    total: subtotal > 0 ? subtotal + tax : storedTotal,
  }
}

function computeAppointmentTotal(
  apt: Appointment,
  packageOptions: { name: string; price: number; features?: string[] }[],
  serviceOptions: { name: string; price: number }[],
  currentSettingsRate: number,
) {
  // Prefer the total locked in at booking time (server-persisted). Live catalog
  // recompute can disagree with the WS optimistic payload / renamed catalog items
  // and briefly show a wrong amount until the next refresh.
  const stored = Number(apt.totalAmount ?? 0)
  if (stored > 0) return stored

  const breakdown = getAppointmentLineBreakdown(apt, packageOptions, serviceOptions)
  const subtotal = breakdown.servicesSubtotal + breakdown.packagesSubtotal
  const { total: catalogTotal } = resolveBookingTax(apt, subtotal, currentSettingsRate)
  if (catalogTotal > 0) return catalogTotal

  const due = Number(apt.dueAmount ?? 0)
  return due > 0 ? due : 0
}

/** Prefer catalog line prices; if missing, reverse tax out of stored totalAmount. */
function resolveConfirmSubtotal(
  apt: Appointment,
  packageOptions: { name: string; price: number; features?: string[] }[],
  serviceOptions: { name: string; price: number }[],
  taxRate: number,
) {
  const breakdown = getAppointmentLineBreakdown(apt, packageOptions, serviceOptions)
  const catalogSubtotal = breakdown.servicesSubtotal + breakdown.packagesSubtotal
  if (catalogSubtotal > 0) {
    return { breakdown, subtotal: catalogSubtotal }
  }

  const stored = Number(apt.totalAmount ?? 0)
  if (stored <= 0) {
    return { breakdown, subtotal: 0 }
  }

  const rate = Number(taxRate || 0)
  const reversed = rate > 0 ? stored / (1 + rate / 100) : stored
  return { breakdown, subtotal: Math.max(0, reversed) }
}

/** POS-style: discount on subtotal, then tax on remaining. */
function computeConfirmFinancials(
  subtotal: number,
  taxMode: ConfirmAmountMode,
  taxValue: number,
  discountMode: ConfirmAmountMode,
  discountValue: number,
) {
  const safeSubtotal = Math.max(0, subtotal)
  const discountAmount =
    discountMode === "flat"
      ? Math.min(safeSubtotal, Math.max(0, discountValue))
      : Math.min(safeSubtotal, (safeSubtotal * Math.min(100, Math.max(0, discountValue))) / 100)
  const taxableBase = Math.max(0, safeSubtotal - discountAmount)
  const taxAmount =
    taxMode === "flat"
      ? Math.max(0, taxValue)
      : Math.ceil((taxableBase * Math.max(0, taxValue)) / 100)
  const total = taxableBase + taxAmount
  return { discountAmount, taxAmount, taxableBase, total }
}

function sanitizeMoneyInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned
}

/** Collapse whitespace/tabs so catalog names match appointment labels. */
function normalizeCatalogName(name: string) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
}

function findCatalogPrice(catalog: { name: string; price: number }[], name: string): number {
  const key = normalizeCatalogName(name).toLowerCase()
  if (!key) return 0
  const hit =
    catalog.find((c) => normalizeCatalogName(c.name).toLowerCase() === key) ??
    catalog.find((c) => c.name === name)
  return Number(hit?.price) || 0
}

function groupNamedLines(names: string[], catalog: { name: string; price: number }[]) {
  const counts = new Map<string, number>()
  for (const raw of names) {
    const name = normalizeCatalogName(raw)
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([name, qty]) => {
    const unitPrice = findCatalogPrice(catalog, name)
    return { name, qty, unitPrice, lineTotal: unitPrice * qty }
  })
}

function normalizeFeatureList(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.map((f) => String(f || "").trim()).filter(Boolean)
  }
  if (typeof features === "string" && features.trim()) {
    return features.split(",").map((s) => s.trim()).filter(Boolean)
  }
  return []
}

// Services and packages are billed fully independently — mirrors the server's
// getBillableServiceNames in appointments.service.ts. A package's `features` list is
// informational only ("what's included"), never a reason to waive an explicitly
// selected service just because the name overlaps. Kept the (apt, packageOptions,
// serviceOptions) signature so every call site below stays untouched.
function getBillableServiceNames(
  serviceNames: string[],
  _apt: Appointment,
  _packageOptions?: { name: string; features?: string[] }[],
  _serviceOptions?: { name: string }[],
) {
  return serviceNames.map((n) => n.trim()).filter(Boolean)
}

function getAppointmentLineBreakdown(
  apt: Appointment,
  packageOptions: { name: string; price: number; features?: string[] }[],
  serviceOptions: { name: string; price: number }[],
) {
  const packageTitles = splitLabelNames(apt.packageName)
  const serviceNames = getBillableServiceNames(
    splitLabelNames(apt.service),
    apt,
    packageOptions,
    serviceOptions,
  )

  const services = groupNamedLines(serviceNames, serviceOptions)
  const packages = groupNamedLines(packageTitles, packageOptions)
  const servicesQty = services.reduce((n, i) => n + i.qty, 0)
  const packagesQty = packages.reduce((n, i) => n + i.qty, 0)
  const servicesSubtotal = services.reduce((n, i) => n + i.lineTotal, 0)
  const packagesSubtotal = packages.reduce((n, i) => n + i.lineTotal, 0)

  return {
    services,
    packages,
    servicesQty,
    packagesQty,
    servicesSubtotal,
    packagesSubtotal,
  }
}

const emptyForm = {
  client: "",
  phone: "",
  services: [] as string[],
  employee: "",
  date: "",
  time: "",
  source: "Online" as AppointmentSource,
  isPackage: false,
  packageName: "",
  applyCommission: true,
  advance: 0,
  discount: 0,
  dueAmount: 0,
  inTime: "",
  outTime: "",
}

type NewAppointmentField = "phone" | "client" | "services" | "employee" | "date" | "time"

function AppointmentsContent() {
  const { user, loading: authLoading } = useAuth()
  const isStylistUser = user?.role === "stylist"
  const stylistName = (user?.employeeName ?? "").trim()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceOptions, setServiceOptions] = useState<{ name: string; price: number; commission: number }[]>([])
  const [packageOptions, setPackageOptions] = useState<{ name: string; price: number; features?: string[] }[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 500)
  const [timeFilter, setTimeFilter] = useState(() => {
    const param = searchParams.get("timeFilter")
    return param && timeFilterOptions.includes(param) ? param : "All Time"
  })
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [apptFromOpen, setApptFromOpen] = useState(false)
  const [apptToOpen, setApptToOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("All Status")
  const [activeKpi, setActiveKpi] = useState<BookingKpiKey | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [taxRate, setTaxRate] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [unreadBookingIds, setUnreadBookingIds] = useState<Set<string>>(() => loadUnreadBookingIds())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clearBookingsOpen, setClearBookingsOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmAppointment, setConfirmAppointment] = useState<Appointment | null>(null)
  const [confirmStaffSelected, setConfirmStaffSelected] = useState("")
  const [confirmAdvanceInput, setConfirmAdvanceInput] = useState("")
  const [confirmTaxMode, setConfirmTaxMode] = useState<ConfirmAmountMode>("percentage")
  const [confirmTaxInput, setConfirmTaxInput] = useState("")
  const [confirmDiscountMode, setConfirmDiscountMode] = useState<ConfirmAmountMode>("percentage")
  const [confirmDiscountInput, setConfirmDiscountInput] = useState("")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [newAppointment, setNewAppointment] = useState(emptyForm)
  const [nameLocked, setNameLocked] = useState(false)
  const [newAppointmentErrors, setNewAppointmentErrors] = useState<Partial<Record<NewAppointmentField, string>>>({})
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false)
  const [minDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [maxDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 60)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [openTime, setOpenTime] = useState("")
  const [closeTime, setCloseTime] = useState("")

  // Note: Permission checks are handled by AuthGuard
  // Removed faulty permission redirect that was causing unexpected redirects
  const minDateObject = new Date(`${minDate}T00:00:00`)
  const maxDateObject = new Date(`${maxDate}T23:59:59`)

  // Kept for the create-booking modal below (unused for now — New Booking goes to POS)
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      router.replace("/admin/pos")
    }
  }, [searchParams, router])


  const normalizePhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "")
    if (digitsOnly.startsWith("8801") && digitsOnly.length === 13) return digitsOnly
    if (digitsOnly.startsWith("01") && digitsOnly.length === 11) return digitsOnly
    if (digitsOnly.startsWith("1") && digitsOnly.length === 10) return `0${digitsOnly}`
    return digitsOnly
  }

  const syncClientFromPhone = useCallback((phoneValue: string) => {
    const normalizedPhone = normalizePhone(phoneValue)
    if (!normalizedPhone) {
      setNameLocked(false)
      setNewAppointment((current) => ({ ...current, client: "" }))
      return
    }

    const matchedClient = clientOptions.find((client) => normalizePhone(client.phone) === normalizedPhone)
    if (matchedClient) {
      setNameLocked(true)
      setNewAppointment((current) => ({ ...current, client: matchedClient.name }))
      return
    }

    setNameLocked(false)
    setNewAppointment((current) => ({ ...current, client: "" }))
  }, [clientOptions])

  useEffect(() => {
    syncClientFromPhone(newAppointment.phone)
  }, [newAppointment.phone, clientOptions, syncClientFromPhone])

  const fetchAppointments = useCallback(async (noCache = false, opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true)
      const res = await getAppointments({
        page: 1,
        limit: 1000,
        ...(isStylistUser && stylistName ? { staff: stylistName } : {}),
      }, noCache)
      const list: AppointmentRecord[] = res?.data ?? res ?? []
      const mapped = Array.isArray(list) ? list.map(toUIAppointment) : []
      setAppointments(mapped)
      setUnreadBookingIds(pruneUnreadBookingIds(mapped.map((a) => a.id)))
    } catch (err) {
      console.error("Failed to fetch appointments", err)
      if (!opts?.silent) setAppointments([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isStylistUser, stylistName])

  const fetchClients = useCallback(async (noCache = false) => {
    const res = await getClients(1, 1000, noCache)
    const list = res?.data ?? res ?? []
    setClientOptions(
      (Array.isArray(list) ? list : []).map((client: any) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
      })),
    )
  }, [])

  useEffect(() => {
    fetchAppointments(true)
    getActiveServices(true)
      .then((list: { name: string; price: number; commission: number }[]) => {
        const rows = Array.isArray(list) ? list : (list as any)?.data ?? []
        setServiceOptions(
          rows.map((s: any) => ({
            name: normalizeCatalogName(s.name),
            price: Number(s.price) || 0,
            commission: parseFloat((s.commission ?? 0).toString()),
          })),
        )
      })
      .catch(console.error)
    getPackages(true)
      .then((res) => {
        const list = res
        setPackageOptions(
          list.map((p: any) => ({
            name: normalizeCatalogName(p.title || p.name),
            price: Number(p.price) || 0,
            features: normalizeFeatureList(p.features).map(normalizeCatalogName),
          })),
        )
      })
      .catch(console.error)
    getStylists(true)
      .then((list: { name: string }[]) => setEmployeeOptions(list.map((e) => e.name)))
      .catch(console.error)
    fetchClients(true)
      .catch(console.error)
    getAppointmentSettings()
      .then((settings) => {
        if (settings?.openingTime) setOpenTime(settings.openingTime.substring(0, 5))
        if (settings?.closingTime) setCloseTime(settings.closingTime.substring(0, 5))
      })
      .catch(console.error)
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate != null && !Number.isNaN(Number(settings.taxRate))) {
          setTaxRate(Number(settings.taxRate))
        }
      })
      .catch(console.error)
  }, [fetchAppointments, fetchClients])

  // Live-refresh bookings table when a website booking arrives
  useEffect(() => {
    let socket: any
    let cancelled = false
      ; (async () => {
        const { io } = await import("socket.io-client")
        if (cancelled) return
        const token =
          typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
        if (!token) return
        const { url, options } = getSocketConnection()
        socket = io(url, {
          ...options,
          auth: { branchId: document.cookie.split('; ').find(value => value.startsWith('branchId='))?.slice(9), token },
        })
        socket.on("new-appointment", (payload: any) => {
          if (payload?.id) {
            persistMarkBookingUnread(String(payload.id))
          }
          // Always reload from the API — optimistic WS payloads have shown wrong
          // services/packages/totals until a manual refresh. Silent so the table
          // doesn't flash a full-page loading state on every new order.
          void fetchAppointments(true, { silent: true })
        })
      })()
    return () => {
      cancelled = true
      socket?.disconnect()
    }
  }, [fetchAppointments])

  useEffect(() => {
    if (!isStylistUser || !stylistName) return
    setNewAppointment((current) =>
      current.employee === stylistName ? current : { ...current, employee: stylistName },
    )
  }, [isStylistUser, stylistName])

  const scopedAppointments = useMemo(
    () =>
      appointments.filter(
        (apt) =>
          !isStylistUser ||
          (stylistName && apt.employee?.toLowerCase() === stylistName.toLowerCase()),
      ),
    [appointments, isStylistUser, stylistName],
  )

  const periodAppointments = useMemo(
    () =>
      scopedAppointments.filter((apt) =>
        appointmentMatchesTimeFilter(apt.date, timeFilter, customDateFrom, customDateTo),
      ),
    [scopedAppointments, timeFilter, customDateFrom, customDateTo],
  )

  const filteredAppointments = useMemo(() => {
    const rows = scopedAppointments.filter((apt) => {
      const q = debouncedSearchQuery.trim().toLowerCase()
      const qDigits = debouncedSearchQuery.replace(/\D/g, "")
      const matchesSearch =
        !q ||
        apt.client.toLowerCase().includes(q) ||
        apt.phone.toLowerCase().includes(q) ||
        (qDigits.length > 0 && apt.phone.replace(/\D/g, "").includes(qDigits))
      const matchesStatus = statusFilter === "All Status" || apt.status === statusFilter
      const matchesTime = appointmentMatchesTimeFilter(
        apt.date,
        timeFilter,
        customDateFrom,
        customDateTo,
      )

      return matchesSearch && matchesStatus && matchesTime
    })

    // Latest request time first
    return [...rows].sort(
      (a, b) => requestTimeMs(b.createdAt) - requestTimeMs(a.createdAt),
    )
  }, [
    scopedAppointments,
    debouncedSearchQuery,
    statusFilter,
    timeFilter,
    customDateFrom,
    customDateTo,
  ])

  const markBookingRead = useCallback((id: string) => {
    if (!id) return
    setUnreadBookingIds(persistMarkBookingRead(id))
  }, [])

  // Stay in sync when NotificationProvider (or another tab) marks a booking unread/read
  useEffect(() => {
    const sync = () => setUnreadBookingIds(loadUnreadBookingIds())
    window.addEventListener(UNREAD_BOOKINGS_EVENT, sync)
    window.addEventListener("storage", sync)
    // Re-sync on mount in case a booking arrived while this page was unmounted
    sync()
    return () => {
      window.removeEventListener(UNREAD_BOOKINGS_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const handleKpiSelect = (key: BookingKpiKey) => {
    // Toggle off if the same card is clicked again (keep current time period)
    if (activeKpi === key) {
      setActiveKpi(null)
      setStatusFilter("All Status")
      return
    }
    setActiveKpi(key)
    setSearchQuery("")
    switch (key) {
      case "total":
        setStatusFilter("All Status")
        break
      case "pending":
        setStatusFilter("Pending")
        break
      case "confirmed":
        setStatusFilter("Confirmed")
        break
      case "cancelled":
        setStatusFilter("Cancelled")
        break
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchQuery, timeFilter, statusFilter, customDateFrom, customDateTo])

  // Keep KPI highlight in sync when status filter is changed manually
  useEffect(() => {
    if (statusFilter === "Pending") setActiveKpi("pending")
    else if (statusFilter === "Confirmed") setActiveKpi("confirmed")
    else if (statusFilter === "Cancelled") setActiveKpi("cancelled")
    else if (statusFilter === "All Status" && activeKpi && activeKpi !== "total") {
      setActiveKpi(null)
    }
  }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredAppointments, row => String(row.id))
  const paginatedAppointments = cursorTable.data

  const clearNewAppointmentError = (field: NewAppointmentField) => {
    setNewAppointmentErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateNewAppointment = () => {
    const errors: Partial<Record<NewAppointmentField, string>> = {}
    if (!newAppointment.phone.trim()) errors.phone = "Please fill this field."
    if (!newAppointment.client.trim()) errors.client = "Please fill this field."
    if (!newAppointment.isPackage && newAppointment.services.length === 0) {
      errors.services = "Please select at least one service."
    }
    if (newAppointment.isPackage && !newAppointment.packageName) {
      errors.services = "Please select a package."
    }
    if (!newAppointment.employee.trim()) errors.employee = "Please fill this field."
    if (!newAppointment.date.trim()) {
      errors.date = "Please fill this field."
    } else {
      if (newAppointment.date < minDate) errors.date = "Please select a valid upcoming date."
      if (newAppointment.date > maxDate) errors.date = "Date cannot exceed 60 days."
    }

    if (!newAppointment.time.trim()) {
      errors.time = "Please fill this field."
    } else {
      if (!isTimeWithinBounds(newAppointment.time, openTime || undefined, closeTime || undefined)) {
        errors.time = `Time cannot be before ${openTime} and after ${closeTime}.`
      }
    }
    return errors
  }

  const handleAddAppointment = async () => {
    const errors = validateNewAppointment()
    setNewAppointmentErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      setIsSubmitting(true)
      const bookingTotal = computeAppointmentTotal(
        {
          id: "new",
          client: newAppointment.client,
          phone: newAppointment.phone,
          service: newAppointment.services.join(", "),
          employee: newAppointment.employee,
          date: newAppointment.date,
          time: newAppointment.time,
          status: "Pending",
          source: "Walk In",
          isPackage: newAppointment.isPackage,
          packageName: newAppointment.packageName,
          advance: 0,
          discount: 0,
          dueAmount: 0,
          totalAmount: 0,
          taxRate: null,
          inTime: "",
          outTime: "",
          createdAt: "",
        },
        packageOptions,
        serviceOptions,
        taxRate,
      )
      await createAppointment({
        clientName: newAppointment.client,
        phoneNumber: normalizePhone(newAppointment.phone),
        date: newAppointment.date,
        time: newAppointment.time,
        staff: isStylistUser ? stylistName || undefined : newAppointment.employee || undefined,
        services: !newAppointment.isPackage && newAppointment.services.length > 0 ? newAppointment.services : undefined,
        isPackage: newAppointment.isPackage,
        packageName: newAppointment.isPackage ? newAppointment.packageName : undefined,
        source: newAppointment.source,
        applyCommission: newAppointment.applyCommission,
        advance: newAppointment.advance || 0,
        discount: newAppointment.discount || 0,
        totalAmount: bookingTotal,
        dueAmount: newAppointment.dueAmount || bookingTotal,
        inTime: newAppointment.inTime || undefined,
        outTime: newAppointment.outTime || undefined,
      })
      setNewAppointment(emptyForm)
      setNewAppointmentErrors({})
      setNameLocked(false)
      setIsDialogOpen(false)
      fetchAppointments()
      toast.success("Booking created successfully")
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message
      const parsedMessage = Array.isArray(backendMessage)
        ? backendMessage.join(", ")
        : backendMessage || "Failed to create appointment"
      toast.error(parsedMessage)
      console.error("Failed to create appointment", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const needsStylistForConfirm = (appointment: Appointment) => {
    const staff = (appointment.employee || "").trim()
    return !staff || staff.toLowerCase() === "any"
  }

  const openConfirmModal = (appointment: Appointment) => {
    const existingStaff = isStylistUser
      ? stylistName
      : needsStylistForConfirm(appointment)
        ? ""
        : appointment.employee.trim()
    setConfirmAppointment(appointment)
    setConfirmStaffSelected(existingStaff)
    setConfirmAdvanceInput(appointment.advance > 0 ? String(appointment.advance) : "")
    setConfirmTaxMode("percentage")
    // Prefer tax rate snapshotted on this booking; fall back to current settings
    const bookedRate =
      appointment.taxRate != null && Number.isFinite(Number(appointment.taxRate))
        ? Number(appointment.taxRate)
        : null
    setConfirmTaxInput(
      bookedRate != null && bookedRate > 0
        ? String(bookedRate)
        : Number(taxRate) > 0
          ? String(taxRate)
          : "",
    )
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate == null || Number.isNaN(Number(settings.taxRate))) return
        const rate = Number(settings.taxRate)
        setTaxRate(rate)
        // Don't overwrite a booking-time snapshot with the live settings rate
        if (bookedRate == null) {
          setConfirmTaxInput(rate > 0 ? String(rate) : "")
        }
      })
      .catch(() => {
        // keep current taxRate / confirmTaxInput
      })
    if (appointment.discount > 0) {
      setConfirmDiscountMode("flat")
      setConfirmDiscountInput(String(appointment.discount))
    } else {
      setConfirmDiscountMode("percentage")
      setConfirmDiscountInput("")
    }
    setConfirmModalOpen(true)
  }

  const closeConfirmModal = () => {
    setConfirmModalOpen(false)
    setConfirmAppointment(null)
    setConfirmStaffSelected("")
    setConfirmAdvanceInput("")
    setConfirmTaxMode("percentage")
    setConfirmTaxInput("")
    setConfirmDiscountMode("percentage")
    setConfirmDiscountInput("")
  }

  const handleStatusChange = async (appointment: Appointment, newStatus: AppointmentStatus) => {
    if (newStatus === appointment.status) return

    if (newStatus === "Confirmed") {
      openConfirmModal(appointment)
      return
    }

    try {
      setIsSubmitting(true)
      await updateAppointment(appointment.id, {
        status: newStatus,
        staff: appointment.employee || undefined,
      })
      if (newStatus === "Completed") {
        clearCacheByPrefix(CACHE.PAYROLL)
        markStale(CACHE.PAYROLL)
      }
      if (newStatus === "Cancelled") {
        markStale(CACHE.BILLING)
      }
      toast.success(`Booking marked as ${newStatus}`)
      fetchAppointments()
    } catch (err: any) {
      console.error("Failed to update status", err)
      const message = err?.response?.data?.message
      toast.error(Array.isArray(message) ? message.join(", ") : message || "Failed to update status")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmBooking = async () => {
    if (!confirmAppointment) return
    const staffRaw = (isStylistUser ? stylistName : confirmStaffSelected).trim()
    const staff =
      !staffRaw || staffRaw.toLowerCase() === "any" || staffRaw === "__none__"
        ? undefined
        : staffRaw

    const { subtotal } = resolveConfirmSubtotal(
      confirmAppointment,
      packageOptions,
      serviceOptions,
      taxRate,
    )
    if (subtotal <= 0) {
      toast.error("Cannot confirm: booking total is 0. Check package/service prices.")
      return
    }
    const { discountAmount, total: bookingTotal } = computeConfirmFinancials(
      subtotal,
      confirmTaxMode,
      Number(confirmTaxInput) || 0,
      confirmDiscountMode,
      Number(confirmDiscountInput) || 0,
    )
    if (bookingTotal <= 0) {
      toast.error("Cannot confirm with a zero total")
      return
    }
    const advance = Math.min(
      bookingTotal,
      Math.max(0, Number(confirmAdvanceInput) || 0),
    )
    const dueAmount = Math.max(0, bookingTotal - advance)
    try {
      setIsSubmitting(true)
      await updateAppointment(confirmAppointment.id, {
        status: "Confirmed",
        // Empty string clears stylist; omit is not enough when choosing None
        staff: staff ?? "",
        advance,
        discount: discountAmount,
        dueAmount,
        confirmedTotal: bookingTotal,
      })
      markStale(CACHE.BILLING, CACHE.APPOINTMENTS)
      toast.success(
        advance > 0
          ? `Booking confirmed · Advance Tk.${advance} recorded`
          : "Booking confirmed · Invoice created with full due amount",
      )
      closeConfirmModal()
      fetchAppointments()
    } catch (err: any) {
      console.error("Failed to confirm appointment", err)
      const message = err?.response?.data?.message
      toast.error(Array.isArray(message) ? message.join(", ") : message || "Failed to confirm booking")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditAppointment = async () => {
    if (!selectedAppointment) return
    try {
      setIsSubmitting(true)
      const selectedServices = selectedAppointment.service
        ? selectedAppointment.service.split(",").map((svc) => svc.trim()).filter(Boolean)
        : []

      const original = appointments.find((a) => a.id === selectedAppointment.id)
      const newlyConfirming =
        selectedAppointment.status === "Confirmed" && original?.status !== "Confirmed"

      const recalculated = computeAppointmentTotal(
        {
          ...selectedAppointment,
          totalAmount: 0,
          dueAmount: 0,
          service: selectedServices.join(", "),
        },
        packageOptions,
        serviceOptions,
        taxRate,
      )
      const bookingTotal =
        recalculated > 0 ? recalculated : Number(selectedAppointment.totalAmount ?? 0)
      const advance = Math.max(0, Number(selectedAppointment.advance) || 0)
      const dueAmount =
        selectedAppointment.dueAmount > 0
          ? selectedAppointment.dueAmount
          : Math.max(0, bookingTotal - advance)

      if (newlyConfirming && bookingTotal <= 0) {
        toast.error("Cannot confirm with a zero total. Check package/service prices.")
        return
      }

      await updateAppointment(selectedAppointment.id, {
        clientName: selectedAppointment.client,
        date: selectedAppointment.date,
        time: selectedAppointment.time,
        staff: isStylistUser ? stylistName || undefined : selectedAppointment.employee || undefined,
        services: !selectedAppointment.isPackage && selectedServices.length > 0 ? selectedServices : undefined,
        isPackage: selectedAppointment.isPackage,
        packageName: selectedAppointment.isPackage ? selectedAppointment.packageName : undefined,
        status: selectedAppointment.status,
        source: selectedAppointment.source,
        advance,
        discount: selectedAppointment.discount || 0,
        totalAmount: bookingTotal,
        dueAmount,
        inTime: selectedAppointment.inTime || undefined,
        outTime: selectedAppointment.outTime || undefined,
        ...(newlyConfirming ? { confirmedTotal: bookingTotal } : {}),
      } as object)
      toast.success(
        newlyConfirming
          ? "Booking confirmed · Invoice created"
          : "Booking updated successfully",
      )
      setEditDialogOpen(false)
      setSelectedAppointment(null)
      fetchAppointments()
    } catch (err: any) {
      const message = err?.response?.data?.message
      const parsed = Array.isArray(message) ? message.join(", ") : message || "Failed to update appointment"
      toast.error(parsed)
      console.error("Failed to update appointment", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return
    try {
      setIsSubmitting(true)
      await deleteAppointment(selectedAppointment.id)
      setDeleteDialogOpen(false)
      setSelectedAppointment(null)
      toast.success("Booking deleted")
      fetchAppointments()
    } catch (err) {
      console.error("Failed to delete appointment", err)
      toast.error("Failed to delete booking")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearAllBookings = async () => {
    if (appointments.length === 0) {
      setClearBookingsOpen(false)
      toast.message("No bookings to clear")
      return
    }
    try {
      setIsSubmitting(true)
      const results = await Promise.allSettled(
        appointments.map((apt) => deleteAppointment(apt.id)),
      )
      const failed = results.filter((r) => r.status === "rejected").length
      const deleted = results.length - failed
      setClearBookingsOpen(false)
      if (failed > 0) {
        toast.error(`Cleared ${deleted} bookings, ${failed} failed`)
      } else {
        toast.success(`Cleared ${deleted} booking${deleted === 1 ? "" : "s"}`)
      }
      markStale(CACHE.BILLING, CACHE.APPOINTMENTS, CACHE.DASHBOARD)
      fetchAppointments()
    } catch (err) {
      console.error("Failed to clear bookings", err)
      toast.error("Failed to clear bookings")
    } finally {
      setIsSubmitting(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      "SL.",
      "Order Time",
      "Booking Date",
      "Client Name",
      "Phone",
      "Package",
      "Service",
      "Artist Name",
      "Total Price",
      "Status",
    ]
    const csvData = filteredAppointments.map((apt, index) => {
      const totalPrice = computeAppointmentTotal(apt, packageOptions, serviceOptions, taxRate)
      return [
        String(index + 1),
        formatRequestTime(apt.createdAt),
        apt.date,
        apt.client,
        apt.phone,
        formatPackageLabel(apt),
        formatServiceLabel(apt, serviceOptions, packageOptions),
        apt.employee,
        String(totalPrice),
        apt.status,
      ]
        .map((value) => escapeCsvValue(value ?? ""))
        .join(",")
    })
    const csv = [headers.join(","), ...csvData].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bookings.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }



  const getStatusButtonStyle = (status: AppointmentStatus | string) => {
    switch (status) {
      case "Completed":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-[state=open]:bg-emerald-100"
      case "Confirmed":
        return "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 data-[state=open]:bg-sky-100"
      case "Pending":
        return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 data-[state=open]:bg-amber-100"
      case "Cancelled":
        return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 data-[state=open]:bg-rose-100"
      default:
        return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
    }
  }

  const getStatusDotClass = (status: AppointmentStatus | string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-500"
      case "Confirmed":
        return "bg-sky-500"
      case "Pending":
        return "bg-amber-500"
      case "Cancelled":
        return "bg-rose-500"
      default:
        return "bg-slate-400"
    }
  }

  const getStatusItemClass = (status: AppointmentStatus | string) => {
    switch (status) {
      case "Completed":
        return "text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800"
      case "Confirmed":
        return "text-sky-700 focus:bg-sky-50 focus:text-sky-800"
      case "Pending":
        return "text-amber-700 focus:bg-amber-50 focus:text-amber-800"
      case "Cancelled":
        return "text-rose-700 focus:bg-rose-50 focus:text-rose-800"
      default:
        return "text-slate-700 focus:bg-slate-50"
    }
  }

  if (authLoading || (!hasPermission(user, 'appointments') && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        title="Requested Bookings"
        subtitle="Schedule and manage client appointments"
        actions={
          <>
            <AdminHeaderDangerButton
              onClick={() => setClearBookingsOpen(true)}
              disabled={appointments.length === 0 || isSubmitting}
            >
              <Trash2 />
              Clear Bookings
            </AdminHeaderDangerButton>
            <AdminHeaderSecondaryButton onClick={exportToCSV} accessAction="export">
              <Download />
              Export CSV
            </AdminHeaderSecondaryButton>
            <AdminHeaderPrimaryButton asChild accessAction="create">
              <Link href="/admin/pos">
                <Plus />
                New Booking
              </Link>
            </AdminHeaderPrimaryButton>
            {/* Create booking modal kept for later — not opened from the header button for now */}
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) {
                  setNewAppointment(emptyForm)
                  setNewAppointmentErrors({})
                  setNameLocked(false)
                  return
                }
                fetchClients().catch(console.error)
              }}
            >
              <DialogContent className="flex flex-col gap-0 overflow-hidden sm:max-w-[620px]">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Create New Booking</DialogTitle>
                  <DialogDescription>
                    Fill in the required details to create a new booking.
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="mt-2 space-y-5 pb-6">
                    <div className="space-y-2">
                      <Label className="text-[13px] font-semibold tracking-wide">Phone Number <span className="text-destructive">*</span></Label>
                      <Input
                        value={newAppointment.phone}
                        onChange={(e) => {
                          const nextPhone = e.target.value
                          setNewAppointment({ ...newAppointment, phone: nextPhone })
                          syncClientFromPhone(nextPhone)
                          if (!nextPhone.trim()) {
                            clearNewAppointmentError("phone")
                          } else {
                            const stripped = nextPhone.replace(/[\s-]/g, "")
                            if (/^(?:\+88|88)?01[3-9]\d{8}$/.test(stripped)) {
                              clearNewAppointmentError("phone")
                            } else {
                              setNewAppointmentErrors((prev) => ({ ...prev, phone: "Enter a valid Bangladeshi phone number (e.g. 01712345678)" }))
                            }
                          }
                        }}
                        placeholder="e.g. 01712345678"
                      />
                      {newAppointmentErrors.phone && (
                        <p className="text-xs text-destructive">{newAppointmentErrors.phone}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[13px] font-semibold tracking-wide">Client Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={newAppointment.client}
                        onChange={(e) => {
                          const nextClient = e.target.value
                          setNewAppointment({ ...newAppointment, client: nextClient })
                          if (nextClient.trim()) clearNewAppointmentError("client")
                        }}
                        placeholder={nameLocked ? "Client name matched from phone" : "e.g. Alex Rahman"}
                        readOnly={nameLocked}
                        disabled={nameLocked}
                        className={nameLocked ? "bg-muted cursor-not-allowed" : undefined}
                      />
                      {newAppointmentErrors.client && (
                        <p className="text-xs text-destructive">{newAppointmentErrors.client}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[13px] font-semibold tracking-wide">
                          {newAppointment.isPackage ? "Package" : "Service"} <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="isPackage"
                            checked={newAppointment.isPackage}
                            onCheckedChange={(checked) => {
                              setNewAppointment({
                                ...newAppointment,
                                isPackage: checked === true,
                                services: [],
                                packageName: ""
                              })
                              clearNewAppointmentError("services")
                            }}
                          />
                          <Label htmlFor="isPackage" className="text-xs font-normal cursor-pointer">Book a Package</Label>
                        </div>
                      </div>
                      {!newAppointment.isPackage ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                              <span className={newAppointment.services.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                                {newAppointment.services.length === 0
                                  ? "Select services"
                                  : (() => {
                                    const counts: Record<string, number> = {}
                                    newAppointment.services.forEach(n => { counts[n] = (counts[n] || 0) + 1 })
                                    return Object.entries(counts).map(([n, q]) => q > 1 ? `${n} ×${q}` : n).join(", ")
                                  })()}
                              </span>
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                            {serviceOptions.map((s) => {
                              const qty = newAppointment.services.filter(n => n === s.name).length
                              return (
                                <div key={s.name} className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-none truncate">{s.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(s.price)} each</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={qty === 0}
                                      className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-25 disabled:cursor-not-allowed transition-colors select-none"
                                      onClick={() => {
                                        const idx = newAppointment.services.lastIndexOf(s.name)
                                        if (idx === -1) return
                                        const next = newAppointment.services.filter((_, i) => i !== idx)
                                        setNewAppointment({ ...newAppointment, services: next })
                                      }}
                                    >
                                      −
                                    </button>
                                    <span className="w-6 text-center text-sm font-semibold tabular-nums select-none">
                                      {qty > 0 ? qty : <span className="text-muted-foreground/40">0</span>}
                                    </span>
                                    <button
                                      type="button"
                                      className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-base font-bold hover:bg-muted transition-colors select-none"
                                      onClick={() => {
                                        const next = [...newAppointment.services, s.name]
                                        setNewAppointment({ ...newAppointment, services: next })
                                        clearNewAppointmentError("services")
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                            {newAppointment.services.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border px-2 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {newAppointment.services.length} service{newAppointment.services.length !== 1 ? "s" : ""} selected
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-destructive hover:underline"
                                  onClick={() => setNewAppointment({ ...newAppointment, services: [] })}
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Select
                          value={newAppointment.packageName}
                          onValueChange={(val) => {
                            setNewAppointment({ ...newAppointment, packageName: val })
                            if (val) clearNewAppointmentError("services")
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a package" />
                          </SelectTrigger>
                          <SelectContent>
                            {packageOptions.map((p) => (
                              <SelectItem key={p.name} value={p.name}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{p.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">{formatCurrency(p.price)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {newAppointmentErrors.services && (
                        <p className="text-xs text-destructive">{newAppointmentErrors.services}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[13px] font-semibold tracking-wide">Total Price (incl. tax)</Label>
                      <Input placeholder="e.g. 1500"
                        value={`Tk ${(() => {
                          let subtotal = 0
                          if (newAppointment.isPackage && newAppointment.packageName) {
                            const pkg = packageOptions.find((p) => p.name === newAppointment.packageName)
                            subtotal = parseFloat((pkg?.price || 0).toString())
                          } else {
                            subtotal = newAppointment.services.reduce((acc, serviceName) => {
                              const service = serviceOptions.find(
                                (s) =>
                                  normalizeCatalogName(s.name).toLowerCase() ===
                                  normalizeCatalogName(serviceName).toLowerCase(),
                              )
                              return acc + parseFloat((service?.price || 0).toString())
                            }, 0)
                          }
                          const tax = ceilTaxAmount(subtotal, taxRate)
                          return formatMoney(subtotal + tax)
                        })()}`}
                        readOnly
                        className="bg-muted cursor-not-allowed font-medium text-primary"
                      />
                    </div>
                    {(() => {
                      const commissionTotal = newAppointment.isPackage ? 0 : newAppointment.services.reduce((acc, name) => {
                        const svc = serviceOptions.find(
                          (s) =>
                            normalizeCatalogName(s.name).toLowerCase() ===
                            normalizeCatalogName(name).toLowerCase(),
                        )
                        return acc + (svc ? (Number(svc.price) * Number(svc.commission) / 100) : 0)
                      }, 0)
                      if (commissionTotal <= 0) return null
                      return (
                        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-primary/70 shrink-0" />
                            <div>
                              <p className="text-[13px] font-semibold">Employee Commission</p>
                              <p className="text-xs text-muted-foreground">
                                {newAppointment.applyCommission
                                  ? `৳${commissionTotal.toFixed(2)} will be added to the employee's bonus when completed`
                                  : "Commission disabled for this appointment"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-sm font-semibold ${newAppointment.applyCommission ? "text-green-600" : "text-muted-foreground line-through"}`}>
                              ৳{commissionTotal.toFixed(2)}
                            </span>
                            <Switch
                              checked={newAppointment.applyCommission}
                              onCheckedChange={(checked) => setNewAppointment({ ...newAppointment, applyCommission: checked })}
                            />
                          </div>
                        </div>
                      )
                    })()}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Employee <span className="text-destructive">*</span></Label>
                        <Select
                          value={newAppointment.employee}
                          disabled={isStylistUser}
                          onValueChange={(value) => {
                            setNewAppointment({ ...newAppointment, employee: value })
                            if (value.trim()) clearNewAppointmentError("employee")
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeeOptions.map((e) => (
                              <SelectItem key={e} value={e}>{e}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newAppointmentErrors.employee && (
                          <p className="text-xs text-destructive">{newAppointmentErrors.employee}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Source</Label>
                        <Select
                          value={newAppointment.source}
                          onValueChange={(value: AppointmentSource) =>
                            setNewAppointment({ ...newAppointment, source: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Online">Online</SelectItem>
                            <SelectItem value="Walk In">Walk In</SelectItem>
                            <SelectItem value="Call">Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Date <span className="text-destructive">*</span></Label>
                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start px-3 font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className={newAppointment.date ? "text-foreground" : "text-muted-foreground"}>
                                {formatDateDisplay(newAppointment.date)}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                            <DateCalendar
                              mode="single"
                              selected={newAppointment.date ? new Date(`${newAppointment.date}T00:00:00`) : undefined}
                              onSelect={(selected) => {
                                if (!selected) return
                                const nextDate = format(selected, "yyyy-MM-dd")
                                setNewAppointment({ ...newAppointment, date: nextDate })
                                if (nextDate.trim()) clearNewAppointmentError("date")
                                setDatePickerOpen(false)
                              }}
                              disabled={(date) => date < minDateObject || date > maxDateObject}
                              autoFocus
                              startMonth={minDateObject}
                              endMonth={maxDateObject}
                            />
                          </PopoverContent>
                        </Popover>
                        {newAppointmentErrors.date && (
                          <p className="text-xs text-destructive">{newAppointmentErrors.date}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Time <span className="text-destructive">*</span></Label>
                        <ClockPickerField
                          value={newAppointment.time}
                          minTime={openTime || undefined}
                          maxTime={closeTime || undefined}
                          onChange={(nextTime) => {
                            setNewAppointment({ ...newAppointment, time: nextTime })
                            if (nextTime.trim()) clearNewAppointmentError("time")
                          }}
                        />
                        {newAppointmentErrors.time && (
                          <p className="text-xs text-destructive">{newAppointmentErrors.time}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Advance</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newAppointment.advance || ""}
                          onChange={(e) => setNewAppointment({ ...newAppointment, advance: Number(e.target.value) || 0 })}
                          placeholder="e.g. 1500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Discount</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newAppointment.discount || ""}
                          onChange={(e) => setNewAppointment({ ...newAppointment, discount: Number(e.target.value) || 0 })}
                          placeholder="e.g. 10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Due Amount</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newAppointment.dueAmount || ""}
                          onChange={(e) => setNewAppointment({ ...newAppointment, dueAmount: Number(e.target.value) || 0 })}
                          placeholder="e.g. 1500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">In Time</Label>
                        <ClockPickerField
                          value={newAppointment.inTime}
                          placeholder="Select in time"
                          onChange={(nextTime) => setNewAppointment({ ...newAppointment, inTime: nextTime })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-semibold tracking-wide">Out Time</Label>
                        <ClockPickerField
                          value={newAppointment.outTime}
                          placeholder="Select out time"
                          onChange={(nextTime) => setNewAppointment({ ...newAppointment, outTime: nextTime })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddAppointment} className="mt-1 w-full h-10" disabled={isSubmitting} accessAction="create">
                      {isSubmitting ? "Saving...." : "Create Booking"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <BookingKpiCards
        className="mb-6"
        appointments={periodAppointments}
        timeFilter={timeFilter}
        loading={loading}
        active={activeKpi}
        onSelect={handleKpiSelect}
      />

      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
              <Input
                placeholder="Search by client or phone number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[38px] rounded-lg border-[#e7e7e7] bg-white pl-9 text-sm shadow-none focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
              />
            </div>

            <Popover open={showCustomDate && timeFilter === "Custom Date"} onOpenChange={(open) => setShowCustomDate(open)}>
              <PopoverTrigger asChild>
                <div>
                  <Select
                    value={timeFilter}
                    onValueChange={(v) => {
                      setTimeFilter(v)
                      if (v === "Custom Date") setShowCustomDate(true)
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-[38px] w-[150px] rounded-lg border border-[#e7e7e7] bg-white px-3",
                        "text-sm font-medium text-[#333] shadow-none",
                        "focus:ring-2 focus:ring-brand-primary/20 focus:ring-offset-0",
                        "hover:border-[#cfd8e3] [&>svg]:text-[#666]",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                      {timeFilterOptions.map((option) => (
                        <SelectItem key={option} value={option} className="rounded-lg text-sm">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-xl border border-[#e7e7e7] p-4 shadow-xl">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Popover open={apptFromOpen} onOpenChange={setApptFromOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start rounded-lg px-3 font-normal" accessAction="create">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className={customDateFrom ? "text-foreground" : "text-muted-foreground"}>
                            {customDateFrom ? format(new Date(`${customDateFrom}T00:00:00`), "PPP") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={customDateFrom ? new Date(`${customDateFrom}T00:00:00`) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return
                            setCustomDateFrom(format(selected, "yyyy-MM-dd"))
                            setApptFromOpen(false)
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Popover open={apptToOpen} onOpenChange={setApptToOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start rounded-lg px-3 font-normal" accessAction="create">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className={customDateTo ? "text-foreground" : "text-muted-foreground"}>
                            {customDateTo ? format(new Date(`${customDateTo}T00:00:00`), "PPP") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={customDateTo ? new Date(`${customDateTo}T00:00:00`) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return
                            setCustomDateTo(format(selected, "yyyy-MM-dd"))
                            setApptToOpen(false)
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => setShowCustomDate(false)}>Apply</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className={cn(
                  "h-[38px] w-[140px] rounded-lg border border-[#e7e7e7] bg-white px-3",
                  "text-sm font-medium text-[#333] shadow-none",
                  "focus:ring-2 focus:ring-brand-primary/20 focus:ring-offset-0",
                  "hover:border-[#cfd8e3] [&>svg]:text-[#666]",
                  statusFilter !== "All Status" && getStatusButtonStyle(statusFilter),
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[160px] rounded-xl border border-[#e7e7e7] p-1 shadow-lg">
                <SelectItem value="All Status" className="rounded-lg text-sm font-medium">
                  All Status
                </SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={cn("rounded-lg text-sm font-medium", getStatusItemClass(option))}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", getStatusDotClass(option))} />
                      {option}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${filteredAppointments.length} results`}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table cursorPagination={cursorTable} className="table-fixed min-w-[1280px]">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[56px]" />
              <col className="w-[160px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[112px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-[#f2f2f2] hover:bg-transparent">
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  SL.
                </TableHead>
                <TableHead className="h-11 px-2 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  {/* NEW badge column — header left blank for a clean look */}
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Order Time
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Booking Date
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Client Name
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Phone
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Package
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Service
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Artist Name
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Total Price
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Status
                </TableHead>
                <TableHead className="h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={12}
                    className="px-4 py-10 text-left text-sm text-muted-foreground first:pl-4 last:pr-4"
                  >
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={12}
                    className="px-4 py-10 text-left text-sm text-muted-foreground first:pl-4 last:pr-4"
                  >
                    No bookings found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAppointments.map((appointment, index) => {
                  const totalPrice = computeAppointmentTotal(
                    appointment,
                    packageOptions,
                    serviceOptions,
                    taxRate,
                  )
                  const packageLabel = formatPackageLabel(appointment)
                  const serviceLabel = formatServiceLabel(
                    appointment,
                    serviceOptions,
                    packageOptions,
                  )
                  const requestTimeLabel = formatRequestTime(appointment.createdAt)
                  const isUnread = unreadBookingIds.has(appointment.id)

                  return (
                    <TableRow
                      key={appointment.id}
                      className={cn(
                        "border-b border-[#f2f2f2] cursor-pointer transition-colors",
                        isUnread ? "bg-[#f5faff] hover:bg-brand-soft" : "hover:bg-[#f0f7ff]",
                      )}
                      onClick={() => {
                        markBookingRead(appointment.id)
                        setSelectedAppointment(appointment)
                        setViewDialogOpen(true)
                      }}
                    >
                      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] tabular-nums text-[#666]">
                        {cursorTable.pageInfo.from + index}
                      </TableCell>
                      <TableCell className="px-2 py-3 first:pl-4 last:pr-4 text-left">
                        {isUnread ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5",
                              "text-[10px] font-bold uppercase tracking-wide",
                              "bg-brand-primary text-white shadow-sm",
                              "animate-booking-new-blink",
                            )}
                          >
                            New
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] whitespace-nowrap"
                        title={requestTimeLabel !== "—" ? requestTimeLabel : undefined}
                      >
                        {requestTimeLabel}
                      </TableCell>
                      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] whitespace-nowrap">
                        {appointment.date}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium text-[#333] truncate"
                        title={appointment.client}
                      >
                        {appointment.client}
                      </TableCell>
                      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] whitespace-nowrap">
                        {appointment.phone}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate whitespace-nowrap"
                        title={packageLabel !== "—" ? packageLabel : undefined}
                      >
                        {packageLabel}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate whitespace-nowrap"
                        title={serviceLabel !== "—" ? serviceLabel : undefined}
                      >
                        {serviceLabel}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] text-[#333] truncate whitespace-nowrap"
                        title={appointment.employee || undefined}
                      >
                        {appointment.employee || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-3 first:pl-4 last:pr-4 text-left text-[13px] font-medium tabular-nums text-[#333]">
                        {formatMoney(totalPrice)}
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left"
                        onClick={(e) => {
                          e.stopPropagation()
                          markBookingRead(appointment.id)
                        }}
                      >
                        <BookingStatusDropdown
                          status={appointment.status}
                          disabled={isSubmitting}
                          buttonClassName={getStatusButtonStyle}
                          dotClassName={getStatusDotClass}
                          itemClassName={getStatusItemClass}
                          onChange={(next) => {
                            void handleStatusChange(appointment, next)
                          }}
                        />
                      </TableCell>
                      <TableCell
                        className="px-3 py-3 first:pl-4 last:pr-4 text-left"
                        onClick={(e) => {
                          e.stopPropagation()
                          markBookingRead(appointment.id)
                        }}
                      >
                        <div className="flex items-center justify-start gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-[#666] hover:bg-brand-mist hover:text-brand-primary"
                            aria-label={`Edit ${appointment.client}`}
                            onClick={() => {
                              setSelectedAppointment({ ...appointment })
                              setEditDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-[#666] hover:bg-red-50 hover:text-red-500"
                            aria-label={`Delete ${appointment.client}`}
                            onClick={() => {
                              setSelectedAppointment(appointment)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {!loading && filteredAppointments.length > 0 && (
          <></>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-lg sm:max-w-[520px]"
        >
          {selectedAppointment && (() => {
            const breakdown = getAppointmentLineBreakdown(
              selectedAppointment,
              packageOptions,
              serviceOptions,
            )
            const subtotal = breakdown.servicesSubtotal + breakdown.packagesSubtotal
            const { rate: bookingTaxRate, tax, total: computedTotal } = resolveBookingTax(
              selectedAppointment,
              subtotal,
              taxRate,
            )
            // Prefer persisted booking total (same as list row) so the modal never
            // briefly shows a catalog-recomputed amount that disagrees with the DB.
            const storedTotal = Number(selectedAppointment.totalAmount ?? 0)
            const viewTotal =
              storedTotal > 0
                ? storedTotal
                : computedTotal > 0
                  ? computedTotal
                  : Number(selectedAppointment.dueAmount ?? 0)
            // When Total is the stored amount, derive tax so Services + Packages + Tax = Total
            const viewTax =
              storedTotal > 0 && subtotal > 0
                ? Math.max(0, Math.round((storedTotal - subtotal) * 100) / 100)
                : tax
            const showServices = breakdown.services.length > 0
            const showPackages = breakdown.packages.length > 0
            const lineItems = [
              ...breakdown.packages.map((item) => ({ ...item, key: `view-pkg-${item.name}` })),
              ...breakdown.services.map((item) => ({ ...item, key: `view-svc-${item.name}` })),
            ]

            const statusTone =
              selectedAppointment.status === "Confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : selectedAppointment.status === "Pending"
                  ? "bg-amber-50 text-amber-700"
                  : selectedAppointment.status === "Completed"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-rose-50 text-rose-700"

            return (
              <div className="bg-white">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-base font-semibold text-[#111]">
                      {selectedAppointment.client}
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-[12px] text-[#888]">
                      {selectedAppointment.phone}
                      <span className="mx-1.5 text-[#ddd]">·</span>
                      Booking {selectedAppointment.date}{" "}
                      {formatTimeDisplay(selectedAppointment.time)}
                      <span className="mx-1.5 text-[#ddd]">·</span>
                      Ordered {formatRequestTime(selectedAppointment.createdAt)}
                    </DialogDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-medium",
                        statusTone,
                      )}
                    >
                      {selectedAppointment.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewDialogOpen(false)}
                      className="flex size-7 items-center justify-center rounded-md text-[#888] hover:bg-brand-mist hover:text-[#333]"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 px-5 pb-5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] text-[#888]">Order Time</p>
                      <p className="mt-0.5 text-[#333]">
                        {formatRequestTime(selectedAppointment.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#888]">Artist</p>
                      <p className="mt-0.5 truncate text-[#333]">
                        {selectedAppointment.employee || "Any Expert"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#888]">Source</p>
                      <p className="mt-0.5 text-[#333]">{selectedAppointment.source}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#888]">Total</p>
                      <p className="mt-0.5 tabular-nums text-[#333]">
                        {formatMoney(viewTotal)}
                      </p>
                    </div>
                  </div>

                  {(showServices || showPackages) ? (
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <p className="mb-1.5 border-b border-[#e8e8e8] pb-1 text-[11px] uppercase tracking-wide text-[#888]">
                          Services & Packages
                        </p>
                        <ul
                          className={cn(
                            "space-y-1.5 pr-1 text-[13px] text-[#333]",
                            // Hard cap at ~7 rows so row 8+ requires scroll
                            lineItems.length > 7 &&
                            "max-h-[196px] overflow-y-scroll overscroll-contain",
                          )}
                        >
                          {lineItems.map((item) => (
                            <li
                              key={item.key}
                              className="flex items-start justify-between gap-3"
                            >
                              <span className="min-w-0 break-words">
                                {item.name}{" "}
                                <span className="text-brand-primary">×{item.qty}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-[#555]">
                                {formatMoney(item.lineTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1 border-t border-[#eee] pt-2 text-[13px] text-[#444]">
                        {showServices && (
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-[#888]">
                              Services ({breakdown.servicesQty})
                            </span>
                            <span>{formatMoney(breakdown.servicesSubtotal)}</span>
                          </div>
                        )}
                        {showPackages && (
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-[#888]">
                              Packages ({breakdown.packagesQty})
                            </span>
                            <span>{formatMoney(breakdown.packagesSubtotal)}</span>
                          </div>
                        )}
                        {viewTax > 0 && (
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-[#888]">
                              VAT ({bookingTaxRate}%)
                            </span>
                            <span>{formatMoney(viewTax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3 tabular-nums text-[#222]">
                          <span>Total</span>
                          <span>{formatMoney(viewTotal)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#999]">No services or packages</p>
                  )}

                  {(selectedAppointment.inTime || selectedAppointment.outTime) && (
                    <p className="text-[12px] text-[#888]">
                      In {selectedAppointment.inTime ? formatTimeDisplay(selectedAppointment.inTime) : "—"}
                      <span className="mx-1.5 text-[#ddd]">·</span>
                      Out {selectedAppointment.outTime ? formatTimeDisplay(selectedAppointment.outTime) : "—"}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 flex-1 text-[#555] hover:bg-brand-mist"
                      onClick={() => setViewDialogOpen(false)}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      className="h-9 flex-1 bg-brand-primary text-white hover:bg-brand-hover"
                      onClick={() => {
                        setViewDialogOpen(false)
                        setSelectedAppointment({ ...selectedAppointment })
                        setEditDialogOpen(true)
                      }}
                     accessAction="edit">
                      <Pencil className="mr-1.5 size-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setEditDatePickerOpen(false)
        }}
      >
        <DialogContent className="flex flex-col gap-0 overflow-hidden sm:max-w-[620px]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>
              Update booking information and save your changes.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mt-2 space-y-5 pb-6">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold tracking-wide">Client Name</Label>
                  <Input placeholder="e.g. Alex Rahman"
                    value={selectedAppointment.client}
                    onChange={(e) =>
                      setSelectedAppointment({ ...selectedAppointment, client: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold tracking-wide">Phone Number</Label>
                  <Input placeholder="e.g. 01712345678"
                    value={selectedAppointment.phone}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px] font-semibold tracking-wide">
                      {selectedAppointment.isPackage ? "Package" : "Service"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="editIsPackage"
                        checked={selectedAppointment.isPackage}
                        onCheckedChange={(checked) => {
                          setSelectedAppointment({
                            ...selectedAppointment,
                            isPackage: checked === true,
                            service: "",
                            packageName: ""
                          })
                        }}
                      />
                      <Label htmlFor="editIsPackage" className="text-xs font-normal cursor-pointer">Book a Package</Label>
                    </div>
                  </div>
                  {!selectedAppointment.isPackage ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <span className={selectedAppointment.service ? "text-foreground" : "text-muted-foreground"}>
                            {selectedAppointment.service
                              ? (() => {
                                const svcList = selectedAppointment.service.split(",").map(s => s.trim()).filter(Boolean)
                                const counts: Record<string, number> = {}
                                svcList.forEach(n => { counts[n] = (counts[n] || 0) + 1 })
                                return Object.entries(counts).map(([n, q]) => q > 1 ? `${n} ×${q}` : n).join(", ")
                              })()
                              : "Select services"}
                          </span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                        {serviceOptions.map((s) => {
                          const svcList = selectedAppointment.service
                            ? selectedAppointment.service.split(",").map((svc) => svc.trim()).filter(Boolean)
                            : []
                          const qty = svcList.filter(n => n === s.name).length

                          return (
                            <div key={s.name} className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-none truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(s.price)} each</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={qty === 0}
                                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-25 disabled:cursor-not-allowed transition-colors select-none"
                                  onClick={() => {
                                    const idx = svcList.lastIndexOf(s.name)
                                    if (idx === -1) return
                                    const next = svcList.filter((_, i) => i !== idx)
                                    setSelectedAppointment({ ...selectedAppointment, service: next.join(", ") })
                                  }}
                                >
                                  −
                                </button>
                                <span className="w-6 text-center text-sm font-semibold tabular-nums select-none">
                                  {qty > 0 ? qty : <span className="text-muted-foreground/40">0</span>}
                                </span>
                                <button
                                  type="button"
                                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-base font-bold hover:bg-muted transition-colors select-none"
                                  onClick={() => {
                                    const next = [...svcList, s.name]
                                    setSelectedAppointment({ ...selectedAppointment, service: next.join(", ") })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {selectedAppointment.service && (
                          <div className="mt-2 pt-2 border-t border-border px-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {selectedAppointment.service.split(",").filter(Boolean).length} service{selectedAppointment.service.split(",").filter(Boolean).length !== 1 ? "s" : ""} selected
                            </span>
                            <button
                              type="button"
                              className="text-xs text-destructive hover:underline"
                              onClick={() => setSelectedAppointment({ ...selectedAppointment, service: "" })}
                            >
                              Clear all
                            </button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Select
                      value={selectedAppointment.packageName}
                      onValueChange={(val) => {
                        setSelectedAppointment({ ...selectedAppointment, packageName: val })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a package" />
                      </SelectTrigger>
                      <SelectContent>
                        {packageOptions.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            <div className="flex items-center justify-between w-full">
                              <span>{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{formatCurrency(p.price)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold tracking-wide">Total Price (incl. tax)</Label>
                  <Input placeholder="e.g. 1500"
                    value={`৳${(() => {
                      let subtotal = 0
                      if (selectedAppointment.isPackage && selectedAppointment.packageName) {
                        const pkg = packageOptions.find((p) => p.name === selectedAppointment.packageName)
                        subtotal = parseFloat((pkg?.price || 0).toString())
                      } else {
                        const services = selectedAppointment.service ? selectedAppointment.service.split(", ").map(s => s.trim()) : []
                        subtotal = services.reduce((acc, serviceName) => {
                          const service = serviceOptions.find(
                            (s) =>
                              normalizeCatalogName(s.name).toLowerCase() ===
                              normalizeCatalogName(serviceName).toLowerCase(),
                          )
                          return acc + parseFloat((service?.price || 0).toString())
                        }, 0)
                      }
                      const tax = ceilTaxAmount(subtotal, taxRate)
                      return formatMoney(subtotal + tax)
                    })()}`}
                    readOnly
                    className="bg-muted cursor-not-allowed font-medium text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold tracking-wide">Employee</Label>
                  <Select
                    value={selectedAppointment.employee}
                    disabled={isStylistUser}
                    onValueChange={(value) =>
                      setSelectedAppointment({ ...selectedAppointment, employee: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Date</Label>
                    <Popover open={editDatePickerOpen} onOpenChange={setEditDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start px-3 font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className={selectedAppointment.date ? "text-foreground" : "text-muted-foreground"}>
                            {formatDateDisplay(selectedAppointment.date)}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={selectedAppointment.date ? new Date(`${selectedAppointment.date}T00:00:00`) : undefined}
                          onSelect={(selected) => {
                            if (!selected) return
                            const nextDate = format(selected, "yyyy-MM-dd")
                            setSelectedAppointment({ ...selectedAppointment, date: nextDate })
                            setEditDatePickerOpen(false)
                          }}
                          disabled={(date) => date < minDateObject || date > maxDateObject}
                          autoFocus
                          startMonth={minDateObject}
                          endMonth={maxDateObject}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Time</Label>
                    <ClockPickerField
                      value={selectedAppointment.time}
                      minTime={openTime || undefined}
                      maxTime={closeTime || undefined}
                      onChange={(nextTime) =>
                        setSelectedAppointment({ ...selectedAppointment, time: nextTime })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Advance</Label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedAppointment.advance || ""}
                      onChange={(e) => setSelectedAppointment({ ...selectedAppointment, advance: Number(e.target.value) || 0 })}
                      placeholder="e.g. 1500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Discount</Label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedAppointment.discount || ""}
                      onChange={(e) => setSelectedAppointment({ ...selectedAppointment, discount: Number(e.target.value) || 0 })}
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Due Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedAppointment.dueAmount || ""}
                      onChange={(e) => setSelectedAppointment({ ...selectedAppointment, dueAmount: Number(e.target.value) || 0 })}
                      placeholder="e.g. 1500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">In Time</Label>
                    <ClockPickerField
                      value={selectedAppointment.inTime}
                      placeholder="Select in time"
                      onChange={(nextTime) => setSelectedAppointment({ ...selectedAppointment, inTime: nextTime })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">Out Time</Label>
                    <ClockPickerField
                      value={selectedAppointment.outTime}
                      placeholder="Select out time"
                      onChange={(nextTime) => setSelectedAppointment({ ...selectedAppointment, outTime: nextTime })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold tracking-wide">Status</Label>
                  <Select
                    value={selectedAppointment.status}
                    onValueChange={(value: AppointmentStatus) =>
                      setSelectedAppointment({ ...selectedAppointment, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(statusOptions.includes(selectedAppointment.status)
                        ? statusOptions
                        : [selectedAppointment.status, ...statusOptions]
                      ).map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleEditAppointment} className="mt-1 h-10 w-full" disabled={isSubmitting} accessAction="edit">
                  {isSubmitting ? "Save Changes...." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Booking — stylist (optional) + advance payment in one modal */}
      <Dialog
        open={confirmModalOpen}
        onOpenChange={(open) => {
          if (!open) closeConfirmModal()
          else setConfirmModalOpen(true)
        }}
      >
        <DialogContent
          className="flex max-h-[min(78dvh,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]"
          data-scroll-inside="true"
        >
          <DialogHeader className="shrink-0 space-y-0.5 border-b border-[#eee] px-4 py-3 sm:px-5">
            <DialogTitle className="text-[16px]">Confirm Booking</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            {confirmAppointment && (() => {
              const { breakdown, subtotal } = resolveConfirmSubtotal(
                confirmAppointment,
                packageOptions,
                serviceOptions,
                taxRate,
              )
              const taxValue = Number(confirmTaxInput) || 0
              const discountValue = Number(confirmDiscountInput) || 0
              const { taxAmount, discountAmount, total } = computeConfirmFinancials(
                subtotal,
                confirmTaxMode,
                taxValue,
                confirmDiscountMode,
                discountValue,
              )
              const parsedAdvance = Number.parseFloat(confirmAdvanceInput)
              const advanceNow =
                confirmAdvanceInput.trim() === "" || !Number.isFinite(parsedAdvance)
                  ? 0
                  : Math.min(Math.max(0, parsedAdvance), total)
              const dueNow = Math.max(0, total - advanceNow)
              const showServices = breakdown.services.length > 0
              const showPackages = breakdown.packages.length > 0
              const lineItems = [
                ...breakdown.packages.map((item) => ({ ...item, key: `svc-pkg-${item.name}` })),
                ...breakdown.services.map((item) => ({ ...item, key: `svc-svc-${item.name}` })),
              ]

              const clampAdvanceInput = (raw: string) => {
                if (raw === "") {
                  setConfirmAdvanceInput("")
                  return
                }
                const normalized = sanitizeMoneyInput(raw)
                const value = Number.parseFloat(normalized)
                if (Number.isFinite(value) && value > total) {
                  setConfirmAdvanceInput(
                    Number.isInteger(total) ? String(total) : total.toFixed(2),
                  )
                  return
                }
                setConfirmAdvanceInput(normalized)
              }

              const amountModeSelect = (
                value: ConfirmAmountMode,
                onChange: (mode: ConfirmAmountMode) => void,
                id: string,
              ) => (
                <Select value={value} onValueChange={(v) => onChange(v as ConfirmAmountMode)}>
                  <SelectTrigger
                    id={id}
                    className="h-8 w-[52px] shrink-0 rounded-none border-0 border-l border-input px-1.5 shadow-none focus:ring-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="flat">৳</SelectItem>
                  </SelectContent>
                </Select>
              )

              return (
                <div className="space-y-3">
                  <div className="space-y-0.5 text-[13px] text-[#555]">
                    <p>
                      <span className="text-[#888]">Client:</span>{" "}
                      {confirmAppointment.client}
                    </p>
                    <p>
                      <span className="text-[#888]">Time:</span>{" "}
                      {confirmAppointment.date} · {formatTimeDisplay(confirmAppointment.time)}
                    </p>
                  </div>

                  {(showServices || showPackages) && (
                    <div className="space-y-2.5">
                      <div className="min-w-0">
                        <p className="mb-1 border-b border-[#e8e8e8] pb-1 text-[11px] uppercase tracking-wide text-[#888]">
                          Services & Packages
                        </p>
                        <ul
                          className={cn(
                            "space-y-1 pr-1 text-[13px] text-[#333]",
                            // Cap at ~4 rows; longer lists scroll inside this list only
                            lineItems.length > 4 &&
                            "max-h-[108px] overflow-y-auto overscroll-contain",
                          )}
                        >
                          {lineItems.map((item) => (
                            <li
                              key={item.key}
                              className="flex items-start justify-between gap-3"
                            >
                              <span className="min-w-0 break-words">
                                {item.name}{" "}
                                <span className="text-brand-primary">×{item.qty}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-[#555]">
                                {formatMoney(item.lineTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5 border-t border-[#eee] pt-2 text-[13px] text-[#444]">
                        {showServices && (
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-[#888]">
                              Services ({breakdown.servicesQty})
                            </span>
                            <span>{formatMoney(breakdown.servicesSubtotal)}</span>
                          </div>
                        )}
                        {showPackages && (
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-[#888]">
                              Packages ({breakdown.packagesQty})
                            </span>
                            <span>{formatMoney(breakdown.packagesSubtotal)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                          <span className="shrink-0 text-[#888]">VAT</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background">
                              <Input
                                id="confirm-tax-input"
                                type="text"
                                inputMode="decimal"
                                className="h-8 w-[72px] rounded-none border-0 px-2 shadow-none focus-visible:ring-0"
                                placeholder="e.g. 10"
                                value={confirmTaxInput}
                                onChange={(e) => {
                                  const next = sanitizeMoneyInput(e.target.value)
                                  if (confirmTaxMode === "percentage") {
                                    const n = Number.parseFloat(next)
                                    if (Number.isFinite(n) && n > 100) {
                                      setConfirmTaxInput("100")
                                      return
                                    }
                                  }
                                  setConfirmTaxInput(next)
                                }}
                              />
                              {amountModeSelect(confirmTaxMode, setConfirmTaxMode, "confirm-tax-mode")}
                            </div>
                            <span className="w-[76px] shrink-0 text-right tabular-nums">
                              {formatMoney(taxAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="shrink-0 text-[#888]">Discount</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background">
                              <Input
                                id="confirm-discount-input"
                                type="text"
                                inputMode="decimal"
                                className="h-8 w-[72px] rounded-none border-0 px-2 shadow-none focus-visible:ring-0"
                                placeholder="e.g. 10"
                                value={confirmDiscountInput}
                                onChange={(e) => {
                                  const next = sanitizeMoneyInput(e.target.value)
                                  if (confirmDiscountMode === "percentage") {
                                    const n = Number.parseFloat(next)
                                    if (Number.isFinite(n) && n > 100) {
                                      setConfirmDiscountInput("100")
                                      return
                                    }
                                  }
                                  setConfirmDiscountInput(next)
                                }}
                              />
                              {amountModeSelect(
                                confirmDiscountMode,
                                setConfirmDiscountMode,
                                "confirm-discount-mode",
                              )}
                            </div>
                            <span className="w-[76px] shrink-0 text-right tabular-nums">
                              {discountAmount > 0 ? `−${formatMoney(discountAmount)}` : formatMoney(0)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between gap-3 tabular-nums text-[#222]">
                          <span>Total</span>
                          <span>{formatMoney(total)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-stylist-select">
                      Artist{" "}
                      <span className="text-xs font-normal text-[#999]">(optional)</span>
                    </Label>
                    <Select
                      value={confirmStaffSelected || undefined}
                      onValueChange={(v) =>
                        setConfirmStaffSelected(v === "__none__" ? "" : v)
                      }
                      disabled={isStylistUser}
                    >
                      <SelectTrigger id="confirm-stylist-select" className="h-9 w-full">
                        <SelectValue placeholder="Choose an artist…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {employeeOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-advance-input">Advance Payment (Tk)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="confirm-advance-input"
                        type="number"
                        min={0}
                        max={total}
                        step="1"
                        placeholder="e.g. 500"
                        value={confirmAdvanceInput}
                        onChange={(e) => clampAdvanceInput(e.target.value)}
                        className="h-9 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0"
                        disabled={total <= 0}
                        onClick={() =>
                          setConfirmAdvanceInput(
                            Number.isInteger(total) ? String(total) : total.toFixed(2),
                          )
                        }
                      >
                        Full
                      </Button>
                    </div>
                    <div className="space-y-0.5 text-[12px] text-[#666]">
                      <div className="flex justify-between gap-3 tabular-nums">
                        <span>Total</span>
                        <span>{formatMoney(total)}</span>
                      </div>
                      <div className="flex justify-between gap-3 tabular-nums">
                        <span>Due</span>
                        <span className={dueNow > 0 ? "text-rose-600" : "text-emerald-700"}>
                          {formatMoney(dueNow)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter className="mt-0 shrink-0 border-t border-[#eee] px-4 py-3 sm:px-5">
            <Button variant="outline" onClick={closeConfirmModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBooking}
              disabled={isSubmitting}
             accessAction="edit">
              {isSubmitting ? "Confirming…" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Bookings Warning Dialog */}
      <Dialog open={clearBookingsOpen} onOpenChange={setClearBookingsOpen}>
        <DialogContent
          className="min-h-[300px] sm:max-w-[440px]"
          // Compact confirm: no outer dialog scroller (admin layout defaults to overflow-y:auto)
          data-scroll-inside="true"
        >
          <DialogHeader>
            <DialogTitle className="text-rose-600">Clear all bookings?</DialogTitle>
            <DialogDescription>
              This will permanently delete every booking currently in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            You are about to delete{" "}
            <span className="font-semibold">{appointments.length}</span> booking
            {appointments.length === 1 ? "" : "s"}. Linked invoices may also be removed.
            This action cannot be undone.
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setClearBookingsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllBookings}
              disabled={isSubmitting || appointments.length === 0}
            >
              {isSubmitting ? "Clearing…" : "Yes, clear all bookings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>Delete Booking</DialogTitle>
            <DialogDescription>
              This action permanently removes the selected booking.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete the booking for{" "}
            <span className="font-medium text-foreground">{selectedAppointment?.client}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAppointment} disabled={isSubmitting} accessAction="delete">
              {isSubmitting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsContent />
    </Suspense>
  )
}
