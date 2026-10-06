"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"
import { useDebounce } from "@/hooks/use-debounce"
import { useBiometricSocket, type AttendanceUpdatedPayload } from "@/hooks/use-biometric-socket"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Download,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  AlertCircle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Pencil,
  FlaskConical,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ClockPickerField } from "@/components/ui/clock-picker"
import {
  getAttendance,
  getTodayAttendance,
  getAttendanceDevices,
  syncAttendanceNow,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  formatTime,
  formatWorkingTime,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@admin/api/attendance/attendance"
import { getEmployees } from "@admin/api/employees/employees"
import { toast } from '@/lib/toast'
import { cn } from "@/lib/utils"
import { AdminPageHeader, AdminHeaderPrimaryButton, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header"
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_EDIT,
  ACTION_DELETE,
} from "@admin/lib/table-styles"

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = ["2024", "2025", "2026"]
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const PAGE_SIZE = 10

type ViewMode = "today" | "calendar" | "date"

const DUMMY_DEVICE_SN = "ZKTECO-DEMO-01"

function buildDummyAttendance(date: string): AttendanceRecord[] {
  const at = (time: string) => `${date}T${time}.000Z`
  return [
    {
      id: "dummy-1",
      employeeId: "dummy-emp-1",
      employeeName: "Ayesha Rahman",
      machineId: "101",
      deviceSerial: DUMMY_DEVICE_SN,
      attendanceDate: date,
      checkInTime: at("03:05:00"),
      checkOutTime: at("12:00:00"),
      workingMinutes: 535,
      status: "present",
      createdAt: at("03:05:00"),
    },
    {
      id: "dummy-2",
      employeeId: "dummy-emp-2",
      employeeName: "Karim Hassan",
      machineId: "102",
      deviceSerial: DUMMY_DEVICE_SN,
      attendanceDate: date,
      checkInTime: at("04:25:00"),
      checkOutTime: at("12:10:00"),
      workingMinutes: 465,
      status: "late",
      createdAt: at("04:25:00"),
    },
    {
      id: "dummy-3",
      employeeId: "dummy-emp-3",
      employeeName: "Nusrat Jahan",
      machineId: "103",
      deviceSerial: DUMMY_DEVICE_SN,
      attendanceDate: date,
      checkInTime: at("03:00:00"),
      checkOutTime: null,
      workingMinutes: null,
      status: null,
      createdAt: at("03:00:00"),
    },
    {
      id: "dummy-4",
      employeeId: "dummy-emp-4",
      employeeName: "Rafiul Islam",
      machineId: "104",
      deviceSerial: "ZKTECO-DEMO-02",
      attendanceDate: date,
      checkInTime: at("03:10:00"),
      checkOutTime: at("07:00:00"),
      workingMinutes: 230,
      status: "half_day",
      createdAt: at("03:10:00"),
    },
    {
      id: "dummy-5",
      employeeId: "dummy-emp-5",
      employeeName: "Sadia Akter",
      machineId: "105",
      deviceSerial: DUMMY_DEVICE_SN,
      attendanceDate: date,
      checkInTime: at("03:02:00"),
      checkOutTime: at("12:05:00"),
      workingMinutes: 543,
      status: "present",
      createdAt: at("03:02:00"),
    },
    {
      id: "dummy-6",
      employeeId: "dummy-emp-6",
      employeeName: "Tanvir Ahmed",
      machineId: "106",
      deviceSerial: "ZKTECO-DEMO-02",
      attendanceDate: date,
      checkInTime: at("04:40:00"),
      checkOutTime: at("12:15:00"),
      workingMinutes: 455,
      status: "late",
      createdAt: at("04:40:00"),
    },
  ]
}

function buildDummyMonthRecords(year: number, month0: number, todayDate: string): AttendanceRecord[] {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const todayDay = Number(todayDate.split("-")[2])
  const records: AttendanceRecord[] = []
  const names = [
    "Ayesha Rahman",
    "Karim Hassan",
    "Nusrat Jahan",
    "Rafiul Islam",
    "Sadia Akter",
    "Tanvir Ahmed",
  ]
  const statuses: AttendanceStatus[] = ["present", "late", "half_day", "present", "late", "present"]

  for (let day = 1; day <= Math.min(daysInMonth, todayDay); day++) {
    const date = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    names.forEach((name, i) => {
      // Sparse pattern so calendar isn't fully filled
      if ((day + i) % 3 === 0) return
      const status = day === todayDay ? (buildDummyAttendance(todayDate)[i]?.status ?? statuses[i]) : statuses[i]
      const checkIn = `${date}T03:05:00.000Z`
      const checkOut = status === null ? null : `${date}T12:00:00.000Z`
      records.push({
        id: `dummy-m-${date}-${i}`,
        employeeId: `dummy-emp-${i + 1}`,
        employeeName: name,
        machineId: String(101 + i),
        deviceSerial: i % 2 === 0 ? DUMMY_DEVICE_SN : "ZKTECO-DEMO-02",
        attendanceDate: date,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workingMinutes: checkOut ? 500 + i * 5 : null,
        status: day === todayDay ? (buildDummyAttendance(todayDate)[i]?.status ?? status) : status,
        createdAt: checkIn,
      })
    })
  }

  // Prefer the curated today rows for today's date
  const withoutToday = records.filter((r) => r.attendanceDate !== todayDate)
  return [...withoutToday, ...buildDummyAttendance(todayDate)]
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<NonNullable<AttendanceStatus>, { label: string; cls: string; icon: React.ReactNode }> = {
  present: {
    label: "Present",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  late: {
    label: "Late",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <Clock className="size-3.5" />,
  },
  half_day: {
    label: "Half Day",
    cls: "border-orange-200 bg-orange-50 text-orange-700",
    icon: <MinusCircle className="size-3.5" />,
  },
  absent: {
    label: "Absent",
    cls: "border-rose-200 bg-rose-50 text-rose-700",
    icon: <XCircle className="size-3.5" />,
  },
}

function StatusBadge({ status, checkInTime, checkOutTime }: { status: AttendanceStatus | null; checkInTime: string | null; checkOutTime: string | null }) {
  if (!status && checkInTime && !checkOutTime) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
        <Clock className="size-3.5" />Working
      </span>
    )
  }
  if (!status) return <span className="text-[12px] text-[#888]">No exit</span>
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ─── Calendar day icon ────────────────────────────────────────────────────────

function DayCell({ status }: { status: AttendanceStatus | null | "off" | "future" }) {
  if (status === "off" || status === "future") return <span className="w-4 h-4 block" />
  if (status === null) return <AlertCircle className="w-4 h-4 text-muted-foreground/40" />
  if (status === "present") return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === "late") return <Clock className="w-4 h-4 text-amber-500" />
  if (status === "half_day") return <MinusCircle className="w-4 h-4 text-orange-400" />
  if (status === "absent") return <XCircle className="w-4 h-4 text-red-400" />
  return null
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(records: AttendanceRecord[], label: string) {
  const header = ["Employee", "Date", "Check In", "Check Out", "Working Hours", "Status"]
  const rows = records.map(r => [
    r.employeeName,
    r.attendanceDate,
    formatTime(r.checkInTime),
    formatTime(r.checkOutTime),
    formatWorkingTime(r.workingMinutes),
    r.status ?? "no_exit",
  ])
  const csv = [header, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = `attendance-${label}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Custom Bar Chart Tooltip ─────────────────────────────────────────────────

function AttendanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  const items = [
    { key: "present",  label: "Present",  color: "#22c55e" },
    { key: "late",     label: "Late",     color: "#f59e0b" },
    { key: "half_day", label: "Half Day", color: "#f97316" },
    { key: "absent",   label: "Absent",   color: "#ef4444" },
  ]
  const total = items.reduce((s, i) => s + (data?.[i.key] ?? 0), 0)

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden min-w-[160px] -translate-y-6">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Date</p>
        <p className="text-base font-bold text-slate-800">{data?.date ?? label}</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {items.map(({ key, label, color }) => {
          const val = data?.[key] ?? 0
          return (
            <div key={key} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <span className="text-xs font-bold text-slate-800 tabular-nums">{val}</span>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Total</span>
        <span className="text-xs font-bold text-slate-700 tabular-nums">{total}</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const today = new Date()
  const todayDate = today.toISOString().split("T")[0]
  const [viewMode, setViewMode] = useState<ViewMode>("today")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [year, setYear] = useState(String(today.getFullYear()))
  const [month, setMonth] = useState(String(today.getMonth()))  // 0-indexed for display
  const [empFilter, setEmpFilter] = useState<string>("all")
  const [deviceFilter, setDeviceFilter] = useState<string>("all")
  const [devices, setDevices] = useState<string[]>([])
  const [page, setPage] = useState(1)

  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<{ id: string; name: string; status?: string; fingerprintCode?: string | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [useDummyData, setUseDummyData] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // edit dialog
  const [recordToEdit, setRecordToEdit] = useState<AttendanceRecord | null>(null)
  const [editCheckIn, setEditCheckIn] = useState("")
  const [editCheckOut, setEditCheckOut] = useState("")
  const [editStatus, setEditStatus] = useState<AttendanceStatus | "">("")
  const [isSaving, setIsSaving] = useState(false)

  // date picker modal
  const [calPickerOpen, setCalPickerOpen] = useState(false)
  const [calPickerYear, setCalPickerYear] = useState(today.getFullYear())
  const [calPickerMonth, setCalPickerMonth] = useState(today.getMonth())
  const [calPickerSelectedDate, setCalPickerSelectedDate] = useState<string | null>(null)

  // date view (main page)
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [pickerDateRecords, setPickerDateRecords] = useState<AttendanceRecord[]>([])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Fetch today ────────────────────────────────────────────────────────────
  const loadToday = useCallback(async (showError = true) => {
    if (useDummyData) return
    setLoading(true)
    try {
      const recs = await getTodayAttendance()
      setTodayRecords(recs)
    } catch {
      if (showError) {
        toast.error("Failed to load today's attendance")
      }
    } finally {
      setLoading(false)
    }
  }, [useDummyData])

  // ── Fetch month ────────────────────────────────────────────────────────────
  const loadMonth = useCallback(async (showError = true) => {
    if (useDummyData) return
    setLoading(true)
    try {
      const m = Number(month) + 1  // convert from 0-indexed
      const recs = await getAttendance({ month: m, year: Number(year) })
      setMonthRecords(recs)
    } catch {
      if (showError) {
        toast.error("Failed to load attendance")
      }
    } finally {
      setLoading(false)
    }
  }, [month, year, useDummyData])

  const applyDummyData = useCallback(() => {
    const dummyToday = buildDummyAttendance(todayDate)
    const dummyMonth = buildDummyMonthRecords(Number(year), Number(month), todayDate)
    setTodayRecords(dummyToday)
    setMonthRecords(dummyMonth)
    setPickerDateRecords(pickerDate ? buildDummyAttendance(pickerDate) : dummyToday)
    setDevices([DUMMY_DEVICE_SN, "ZKTECO-DEMO-02"])
    setEmployees([
      { id: "dummy-emp-1", name: "Ayesha Rahman", fingerprintCode: "101" },
      { id: "dummy-emp-2", name: "Karim Hassan", fingerprintCode: "102" },
      { id: "dummy-emp-3", name: "Nusrat Jahan", fingerprintCode: "103" },
      { id: "dummy-emp-4", name: "Rafiul Islam", fingerprintCode: "104" },
      { id: "dummy-emp-5", name: "Sadia Akter", fingerprintCode: "105" },
      { id: "dummy-emp-6", name: "Tanvir Ahmed", fingerprintCode: "106" },
    ])
    setLoading(false)
    setPage(1)
  }, [todayDate, year, month, pickerDate])

  const restoreLiveData = useCallback(async () => {
    setLoading(true)
    try {
      const [todayRecs, monthRecs, deviceList, empList] = await Promise.all([
        getTodayAttendance(),
        getAttendance({ month: Number(month) + 1, year: Number(year) }),
        getAttendanceDevices(),
        getEmployees(),
      ])
      setTodayRecords(todayRecs)
      setMonthRecords(monthRecs)
      setDevices(Array.isArray(deviceList) ? deviceList : [])
      setEmployees(Array.isArray(empList) ? empList : [])
      if (pickerDate) {
        const dateRecs = await getAttendance({ date: pickerDate })
        setPickerDateRecords(dateRecs)
      } else {
        setPickerDateRecords([])
      }
      toast.success("Connected to live attendance data")
    } catch {
      toast.error("Failed to reload live attendance")
    } finally {
      setLoading(false)
    }
  }, [month, year, pickerDate])

  const toggleDummyData = useCallback(() => {
    if (useDummyData) {
      setUseDummyData(false)
      void restoreLiveData()
      return
    }
    setUseDummyData(true)
    applyDummyData()
    toast.success("Showing dummy attendance data")
  }, [useDummyData, applyDummyData, restoreLiveData])

  // Keep dummy rows in sync when month / selected date changes
  useEffect(() => {
    if (!useDummyData) return
    applyDummyData()
  }, [useDummyData, year, month, pickerDate, applyDummyData])

  const refreshCurrentView = useCallback(async () => {
    if (useDummyData) {
      applyDummyData()
      toast.message("Dummy data refreshed")
      return
    }
    setSyncing(true)
    try {
      await syncAttendanceNow()
      if (viewMode === "today") {
        await loadToday()
      } else if (viewMode === "date" && pickerDate) {
        const recs = await getAttendance({ date: pickerDate })
        setPickerDateRecords(recs)
      } else {
        await loadMonth()
      }
    } catch {
      toast.error("Failed to sync attendance from device")
    } finally {
      setSyncing(false)
    }
  }, [loadMonth, loadToday, viewMode, pickerDate, useDummyData, applyDummyData])

  useEffect(() => {
    if (useDummyData) return
    // Always load both: month for the bar chart, today for the pie chart and today table
    if (viewMode === "today") {
      loadToday()
      loadMonth(false)
    } else {
      loadMonth()
      loadToday(false)
    }
  }, [viewMode, loadToday, loadMonth, useDummyData])
  useEffect(() => {
    if (useDummyData) return
    getEmployees(true)
      .then((list: any[]) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => { })
  }, [useDummyData])
  useEffect(() => {
    if (useDummyData) return
    getAttendanceDevices()
      .then((list) => setDevices(Array.isArray(list) ? list : []))
      .catch(() => { })
  }, [useDummyData])

  const handleAttendanceUpdated = useCallback((payload: AttendanceUpdatedPayload) => {
    if (useDummyData) return
    if (viewMode === "today") {
      if (payload.attendanceDates.includes(todayDate)) {
        void loadToday(false)
      }
      return
    }

    if (viewMode === "date" && pickerDate) {
      if (payload.attendanceDates.includes(pickerDate)) {
        void getAttendance({ date: pickerDate }).then(setPickerDateRecords).catch(() => { })
      }
      return
    }

    const monthPrefix = `${year}-${String(Number(month) + 1).padStart(2, "0")}`
    if (payload.attendanceDates.some((date) => date.startsWith(monthPrefix))) {
      void loadMonth(false)
    }
  }, [loadMonth, loadToday, month, todayDate, viewMode, year, pickerDate, useDummyData])

  useBiometricSocket({ onAttendanceUpdated: handleAttendanceUpdated })

  // ── Device-serial filtered base sets (drive tables + charts) ────────────────
  const todayDeviceRecords = useMemo(
    () => todayRecords.filter(r => deviceFilter === "all" || r.deviceSerial === deviceFilter),
    [todayRecords, deviceFilter],
  )
  const monthDeviceRecords = useMemo(
    () => monthRecords.filter(r => deviceFilter === "all" || r.deviceSerial === deviceFilter),
    [monthRecords, deviceFilter],
  )
  const pickerDeviceRecords = useMemo(
    () => pickerDateRecords.filter(r => deviceFilter === "all" || r.deviceSerial === deviceFilter),
    [pickerDateRecords, deviceFilter],
  )

  // ── Today table filtered ───────────────────────────────────────────────────
  const todayFiltered = useMemo(() => {
    return todayDeviceRecords.filter(r =>
      r.employeeName.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
      (empFilter === "all" || r.employeeId === empFilter)
    )
  }, [todayDeviceRecords, debouncedSearch, empFilter])

  // ── Calendar data ──────────────────────────────────────────────────────────
  const daysInMonth = useMemo(() => new Date(Number(year), Number(month) + 1, 0).getDate(), [year, month])
  const todayStr = todayDate

  // Build per-employee day map from monthRecords
  const calendarRows = useMemo(() => {
    const empMap = new Map<string, { name: string; days: Map<number, AttendanceStatus | null> }>()
    for (const r of monthDeviceRecords) {
      if (!empMap.has(r.employeeId)) {
        empMap.set(r.employeeId, { name: r.employeeName, days: new Map() })
      }
      const d = Number(r.attendanceDate.split("-")[2])
      empMap.get(r.employeeId)!.days.set(d, r.status)
    }

    return Array.from(empMap.values())
      .filter(e => e.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
  }, [monthDeviceRecords, debouncedSearch])

  const calendarCursor = useLocalCursor(calendarRows, row => row.name)
  const calendarPaged = calendarCursor.data
  const calendarTotal = Math.max(1, Math.ceil(calendarRows.length / PAGE_SIZE))

  const todayTotal = Math.max(1, Math.ceil(todayFiltered.length / PAGE_SIZE))
  const todayCursor = useLocalCursor(todayFiltered, row => row.id)
  const todayPaged = todayCursor.data

  const pickerDateFiltered = useMemo(() => {
    return pickerDeviceRecords.filter(r =>
      r.employeeName.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
      (empFilter === "all" || r.employeeId === empFilter)
    )
  }, [pickerDeviceRecords, debouncedSearch, empFilter])

  const pickerDateTotal = Math.max(1, Math.ceil(pickerDateFiltered.length / PAGE_SIZE))
  const dateCursor = useLocalCursor(pickerDateFiltered, row => row.id)
  const pickerDatePaged = dateCursor.data

  // Number of employees who have a fingerprint linked — Y-axis ceiling for the bar chart
  const fingerprintedCount = useMemo(
    () => employees.filter(e => e.fingerprintCode).length,
    [employees],
  )

  // ── Chart data ─────────────────────────────────────────────────────────────
  const { barData, pieData } = useMemo(() => {
    // Bar chart — always the full current month, one bar per day
    const dayMap = new Map<number, { present: number; late: number; half_day: number; absent: number }>()
    for (const r of monthDeviceRecords) {
      const d = Number(r.attendanceDate.split("-")[2])
      if (!dayMap.has(d)) dayMap.set(d, { present: 0, late: 0, half_day: 0, absent: 0 })
      if (r.status) dayMap.get(d)![r.status as keyof ReturnType<typeof dayMap.get>]++
    }
    const bar = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const day = dayMap.get(d) ?? { present: 0, late: 0, half_day: 0, absent: 0 }
      const dd = String(d).padStart(2, "0")
      const mm = String(Number(month) + 1).padStart(2, "0")
      const yy = year.slice(2)
      const fullDate = `${year}-${mm}-${dd}`
      return { day: `${d}/${Number(month) + 1}`, date: `${dd}-${mm}-${yy}`, fullDate, ...day }
    }) as { day: string; date: string; fullDate: string; present: number; late: number; half_day: number; absent: number }[]

    // Pie chart — selected date records when in date view, otherwise today
    const pieSource = viewMode === "date" ? pickerDeviceRecords : todayDeviceRecords
    const tc = { present: 0, late: 0, half_day: 0, absent: 0 }
    for (const r of pieSource) {
      if (r.status && r.status in tc) tc[r.status as keyof typeof tc]++
    }
    const pie = [
      { name: "Present", value: tc.present, fill: "#22c55e" },
      { name: "Late", value: tc.late, fill: "#f59e0b" },
      { name: "Half Day", value: tc.half_day, fill: "#f97316" },
      { name: "Absent", value: tc.absent, fill: "#ef4444" },
    ].filter(d => d.value > 0)

    return { barData: bar, pieData: pie }
  }, [todayDeviceRecords, monthDeviceRecords, pickerDeviceRecords, daysInMonth, year, month, todayStr, viewMode])

  function toTimeInput(iso: string | null): string {
    if (!iso) return ""
    const date = new Date(iso)
    // Show the time in Asia/Dhaka so the picker reflects the correct local time.
    return new Intl.DateTimeFormat("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Dhaka",
    }).format(date)
  }

  function openEditDialog(r: AttendanceRecord) {
    if (useDummyData) {
      toast.message("Edit is disabled while dummy data is on")
      return
    }
    setRecordToEdit(r)
    setEditCheckIn(toTimeInput(r.checkInTime))
    setEditCheckOut(toTimeInput(r.checkOutTime))
    setEditStatus(r.status ?? "")
  }

  function openCalPicker() {
    setCalPickerYear(today.getFullYear())
    setCalPickerMonth(today.getMonth())
    setCalPickerSelectedDate(null)
    setCalPickerOpen(true)
  }

  async function handleCalPickerDateClick(dateStr: string) {
    setCalPickerSelectedDate(dateStr)
    setCalPickerOpen(false)
    setPickerDate(dateStr)
    setViewMode("date")
    setPage(1)
    if (useDummyData) {
      setPickerDateRecords(buildDummyAttendance(dateStr))
      setLoading(false)
      return
    }
    setPickerDateRecords([])
    setLoading(true)
    try {
      const recs = await getAttendance({ date: dateStr })
      setPickerDateRecords(recs)
    } catch {
      toast.error("Failed to load attendance for this date")
    } finally {
      setLoading(false)
    }
  }

  function prevCalPickerMonth() {
    if (calPickerMonth === 0) {
      setCalPickerMonth(11)
      setCalPickerYear(y => y - 1)
    } else {
      setCalPickerMonth(m => m - 1)
    }
    setCalPickerSelectedDate(null)
  }

  function nextCalPickerMonth() {
    if (calPickerMonth === 11) {
      setCalPickerMonth(0)
      setCalPickerYear(y => y + 1)
    } else {
      setCalPickerMonth(m => m + 1)
    }
    setCalPickerSelectedDate(null)
  }

  async function handleSaveEdit() {
    if (!recordToEdit) return
    setIsSaving(true)
    try {
      const date = recordToEdit.attendanceDate
      const payload: { checkInTime?: string; checkOutTime?: string | null; status?: AttendanceStatus | null } = {}
      if (editCheckIn) payload.checkInTime = `${date}T${editCheckIn}:00+06:00`
      payload.checkOutTime = editCheckOut ? `${date}T${editCheckOut}:00+06:00` : null
      if (editStatus) payload.status = editStatus as AttendanceStatus
      const updated = await updateAttendanceRecord(recordToEdit.id, payload)
      setTodayRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      setMonthRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      setPickerDateRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      toast.success(`Updated attendance for ${recordToEdit.employeeName}`)
      setRecordToEdit(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  function handleDownload() {
    if (viewMode === "today") {
      exportCSV(todayFiltered, `today-${todayStr}`)
    } else if (viewMode === "date" && pickerDate) {
      exportCSV(pickerDateFiltered, `attendance-${pickerDate}`)
    } else {
      exportCSV(monthRecords, `${MONTH_NAMES[Number(month)]}-${year}`)
    }
  }

  async function handleDeleteRow(record: AttendanceRecord) {
    if (deletingId) return
    setDeletingId(record.id)
    try {
      await deleteAttendanceRecord(record.id)
      setTodayRecords(prev => prev.filter(r => r.id !== record.id))
      setMonthRecords(prev => prev.filter(r => r.id !== record.id))
      setPickerDateRecords(prev => prev.filter(r => r.id !== record.id))
      toast.success(`Attendance record deleted for ${record.employeeName}`)
      if (viewMode === "today") {
        await loadToday()
      } else if (viewMode === "date" && pickerDate) {
        const recs = await getAttendance({ date: pickerDate })
        setPickerDateRecords(recs)
      } else {
        await loadMonth()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete attendance row"
      toast.error(message)
    } finally {
      setRecordToDelete(null)
      setDeletingId(null)
    }
  }

  const totalPages = viewMode === "today" ? todayTotal : viewMode === "date" ? pickerDateTotal : calendarTotal

  return (
    <div className={`${DASH_PAGE} space-y-6`}>

      <AdminPageHeader
        title="Attendance"
        subtitle="Monitor staff check-ins, check-outs, and daily presence"
        actions={
          <>
            <AdminHeaderSecondaryButton
              onClick={toggleDummyData}
              title={useDummyData ? "Switch back to live backend data" : "Fill the table with sample rows"}
              className={useDummyData ? "border border-amber-500 bg-amber-500 text-white hover:bg-amber-600" : undefined}
            >
              <FlaskConical />
              {useDummyData ? "Dummy data: On" : "Show dummy data"}
            </AdminHeaderSecondaryButton>
            <AdminHeaderSecondaryButton onClick={openCalPicker} title="Browse attendance by date" className="px-2.5">
              <Calendar />
            </AdminHeaderSecondaryButton>
            <AdminHeaderSecondaryButton onClick={refreshCurrentView} disabled={loading || syncing}>
              <RefreshCw className={(loading || syncing) ? "animate-spin" : undefined} />
              {syncing ? "Syncing" : "Refresh"}
            </AdminHeaderSecondaryButton>
            {viewMode === "today" ? (
              <AdminHeaderPrimaryButton onClick={() => { setViewMode("today"); setPage(1) }}>
                Today
              </AdminHeaderPrimaryButton>
            ) : (
              <AdminHeaderSecondaryButton onClick={() => { setViewMode("today"); setPage(1) }}>
                Today
              </AdminHeaderSecondaryButton>
            )}
            {viewMode === "calendar" ? (
              <AdminHeaderPrimaryButton onClick={() => { setViewMode("calendar"); setPage(1) }}>
                Monthly
              </AdminHeaderPrimaryButton>
            ) : (
              <AdminHeaderSecondaryButton onClick={() => { setViewMode("calendar"); setPage(1) }}>
                Monthly
              </AdminHeaderSecondaryButton>
            )}
          </>
        }
      />


      {/* ── Charts ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar chart — each bar = one day, segments coloured by status */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Attendance Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {`${MONTH_NAMES[Number(month)]} ${year} · each bar is one day`}
              </p>
            </div>
            {/* colour legend */}
            <div className="flex items-center gap-3 flex-wrap sm:justify-end">
              {[
                { label: "Present", color: "#22c55e" },
                { label: "Late", color: "#f59e0b" },
                { label: "Half Day", color: "#f97316" },
                { label: "Absent", color: "#ef4444" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
          {barData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No data for {MONTH_NAMES[Number(month)]} {year}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={barData}
                barSize={10}
                margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
                onClick={(e) => {
                  const index = Number(e?.activeIndex)
                  const fullDate = Number.isInteger(index) ? barData[index]?.fullDate : undefined
                  if (fullDate) handleCalPickerDateClick(fullDate)
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(val) => {
                    if (!isMobile) return val
                    const day = parseInt(val.split("/")[0])
                    return (day === 1 || day % 5 === 0) ? String(day) : ""
                  }}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={50}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.12)", radius: 4 }}
                  content={<AttendanceTooltip />}
                  offset={28}
                />
                <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" stackId="a" fill="#f59e0b" name="Late" />
                <Bar dataKey="half_day" stackId="a" fill="#f97316" name="Half Day" />
                <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart — selected date or today's snapshot */}
        <div className="bg-card rounded-xl border border-border p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground text-sm">
              {viewMode === "date" && pickerDate
                ? `Date: ${pickerDate.split("-").reverse().map((p, i) => i === 2 ? p.slice(2) : p).join("-")} Status`
                : "Today's Status"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewMode === "date" ? "Selected date snapshot" : "Live today snapshot"}
            </p>
          </div>
          {pieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm py-6">
              <Calendar className="w-8 h-8 opacity-25" />
              {viewMode === "date" ? "No records for this date" : "No records today"}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(value, name) => [Number(value ?? 0), String(name ?? '')]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 w-full space-y-1.5">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-foreground tabular-nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Table Card ───────────────────────────────────────────── */}
      <div className={TABLE_CARD_CLASS}>

        {/* Table toolbar */}
        <div className="border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full min-w-0 flex-1 sm:min-w-[220px] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
              <Input
                placeholder="Search employee"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className={SEARCH_INPUT_CLASS}
              />
            </div>

            {((viewMode === "today" || viewMode === "date") || devices.length > 0 || viewMode === "calendar") && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {(viewMode === "today" || viewMode === "date") && (
                  <Select value={empFilter} onValueChange={v => { setEmpFilter(v); setPage(1) }}>
                    <SelectTrigger className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 [&>span]:truncate sm:w-[180px] sm:flex-none")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                      <SelectItem value="all" className="rounded-lg text-sm">All employees</SelectItem>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id} className="rounded-lg text-sm">{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {devices.length > 0 && (
                  <Select value={deviceFilter} onValueChange={v => { setDeviceFilter(v); setPage(1) }}>
                    <SelectTrigger className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 [&>span]:truncate sm:w-[180px] sm:flex-none")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                      <SelectItem value="all" className="rounded-lg text-sm">All devices</SelectItem>
                      {devices.map(sn => (
                        <SelectItem key={sn} value={sn} className="rounded-lg text-sm">{sn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {viewMode === "calendar" && (
                  <>
                    <Select value={month} onValueChange={v => { setMonth(v); setPage(1) }}>
                      <SelectTrigger className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 [&>span]:truncate sm:w-[150px] sm:flex-none")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                        {MONTH_NAMES.map((m, i) => (
                          <SelectItem key={i} value={String(i)} className="rounded-lg text-sm">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={v => { setYear(v); setPage(1) }}>
                      <SelectTrigger className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 [&>span]:truncate sm:w-[110px] sm:flex-none")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                        {YEARS.map(y => (
                          <SelectItem key={y} value={y} className="rounded-lg text-sm">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}

            <span className="text-sm text-[#666] whitespace-nowrap sm:ml-auto">
              {loading
                ? "Loading..."
                : viewMode === "today"
                  ? `${todayFiltered.length} results`
                  : viewMode === "date"
                    ? `${pickerDateFiltered.length} results`
                    : `${calendarRows.length} results`}
            </span>

            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-[38px] gap-1.5 rounded-lg border-[#e7e7e7] bg-white text-[#333] shadow-none hover:border-[#cfd8e3] hover:bg-[#f5f8fc]"
              onClick={handleDownload}
             accessAction="export">
              <Download className="size-3.5" />Export CSV
            </Button>
          </div>
        </div>

        {/* ── TODAY / DATE list views ─────────────────────────────────── */}
        {(viewMode === "today" || viewMode === "date") && (
          <div className="overflow-x-auto">
            <Table cursorPagination={viewMode === "today" ? todayCursor : dateCursor} className="table-fixed min-w-[1080px]">
              <colgroup>
                <col className="w-[56px]" />
                <col className="w-[200px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[110px]" />
              </colgroup>
              <TableHeader>
                <TableRow className={TABLE_HEADER_ROW_CLASS}>
                  <TableHead className={HEAD_CLASS}>SL.</TableHead>
                  <TableHead className={HEAD_CLASS}>Employee</TableHead>
                  <TableHead className={HEAD_CLASS}>Device SN</TableHead>
                  <TableHead className={HEAD_CLASS}>Device UID</TableHead>
                  <TableHead className={HEAD_CLASS}>Check In</TableHead>
                  <TableHead className={HEAD_CLASS}>Check Out</TableHead>
                  <TableHead className={HEAD_CLASS}>Working Hours</TableHead>
                  <TableHead className={HEAD_CLASS}>Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                      Loading attendance…
                    </TableCell>
                  </TableRow>
                ) : (viewMode === "today" ? todayPaged : pickerDatePaged).length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                      {viewMode === "today"
                        ? "No attendance records for today. Records appear when employees scan their fingerprint."
                        : "No attendance records for this date."}
                    </TableCell>
                  </TableRow>
                ) : (
                  (viewMode === "today" ? todayPaged : pickerDatePaged).map((r, i) => (
                    <TableRow key={r.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                        {(viewMode === "today" ? todayCursor : dateCursor).pageInfo.from + i}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-primary">
                            {r.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="truncate font-medium" title={r.employeeName}>
                            {r.employeeName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-mono text-[12px] text-[#666]")}>
                        {r.deviceSerial || "—"}
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-mono text-[12px] text-[#666]")}>
                        {r.machineId}
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums")}>
                        {formatTime(r.checkInTime)}
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums")}>
                        {formatTime(r.checkOutTime)}
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums")}>
                        {formatWorkingTime(r.workingMinutes)}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <StatusBadge status={r.status} checkInTime={r.checkInTime} checkOutTime={r.checkOutTime} />
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_EDIT}
                            aria-label="Edit attendance"
                            onClick={() => openEditDialog(r)}
                            disabled={useDummyData || deletingId === r.id}
                           accessAction="edit">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_DELETE}
                            aria-label="Delete attendance"
                            onClick={() => {
                              if (useDummyData) {
                                toast.message("Delete is disabled while dummy data is on")
                                return
                              }
                              setRecordToDelete(r)
                            }}
                            disabled={useDummyData || deletingId === r.id}
                           accessAction="delete">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── CALENDAR view ──────────────────────────────────────────── */}
        {viewMode === "calendar" && (
          <div className="overflow-x-auto">
            <Table cursorPagination={calendarCursor} className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f2f2f2]">
                  <th className={cn(HEAD_CLASS, "min-w-[180px] whitespace-nowrap")}>
                    Employee Name
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dayNum = i + 1
                    const dateStr = `${year}-${String(Number(month) + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
                    const isToday = dateStr === todayStr
                    return (
                      <th
                        key={dayNum}
                        className={cn(
                          "min-w-[28px] px-1 py-3 text-center text-[12px] font-semibold tracking-wide",
                          isToday ? "text-brand-primary" : "text-[#666]",
                        )}
                      >
                        {dayNum}
                      </th>
                    )
                  })}
                  <th className={cn(HEAD_CLASS, "text-right whitespace-nowrap")}>
                    Absent
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-4 py-10 text-sm text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : calendarPaged.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 2} className="px-4 py-10 text-sm text-muted-foreground">
                      No records for {MONTH_NAMES[Number(month)]} {year}
                    </td>
                  </tr>
                ) : (
                  calendarPaged.map((emp, idx) => {
                    const absentCount = Array.from({ length: daysInMonth }, (_, i) => i + 1)
                      .filter(d => {
                        const dateStr = `${year}-${String(Number(month) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                        if (dateStr > todayStr) return false
                        const s = emp.days.get(d)
                        return !s || s === "absent"
                      }).length

                    return (
                      <tr key={idx} className={TABLE_ROW_CLASS}>
                        <td className={cn(CELL_CLASS, "whitespace-nowrap")}>
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-primary">
                              {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-[#333]">{emp.name}</span>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = i + 1
                          const dateStr = `${year}-${String(Number(month) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                          const isFuture = dateStr > todayStr
                          const status = isFuture ? "future" : emp.days.get(d) ?? null
                          return (
                            <td key={d} className="px-1 py-2.5 text-center">
                              <div className="flex justify-center">
                                <DayCell status={status as any} />
                              </div>
                            </td>
                          )
                        })}
                        <td className={cn(CELL_CLASS, "text-right")}>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              absentCount >= 10
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : absentCount >= 5
                                  ? "border-orange-200 bg-orange-50 text-orange-700"
                                  : "border-sky-200 bg-sky-50 text-sky-700",
                            )}
                          >
                            {absentCount}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <></>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground pb-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            {v.icon}{v.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/40" />No exit recorded
        </div>
      </div>

      {/* ── Edit dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!recordToEdit} onOpenChange={(open) => { if (!open && !isSaving) setRecordToEdit(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
          </DialogHeader>
          {recordToEdit && (
            <div className="space-y-4 py-1 pb-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{recordToEdit.employeeName}</span>
                {" · "}
                {new Date(recordToEdit.attendanceDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="space-y-1.5">
                <Label>Check In</Label>
                <ClockPickerField
                  value={editCheckIn}
                  onChange={setEditCheckIn}
                  placeholder="Select check-in time"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check Out <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <ClockPickerField
                  value={editCheckOut}
                  onChange={setEditCheckOut}
                  placeholder="Select check-out time"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status <span className="text-muted-foreground text-xs">(optional — auto-calculated if blank)</span></Label>
                <Select value={editStatus} onValueChange={v => setEditStatus(v as AttendanceStatus | "")}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Auto-calculate…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecordToEdit(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editCheckIn} accessAction="edit">
              {isSaving ? <><Clock className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Date picker modal ─────────────────────────────────────────── */}
      <Dialog open={calPickerOpen} onOpenChange={(open) => {
        setCalPickerOpen(open)
        if (!open) setCalPickerSelectedDate(null)
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Browse by Date
            </DialogTitle>
          </DialogHeader>

          {/* Month navigation */}
          <div className="flex items-center justify-between px-1 -mt-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevCalPickerMonth}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-semibold">{MONTH_NAMES[calPickerMonth]} {calPickerYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextCalPickerMonth}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground pb-1 font-medium">{d}</div>
            ))}
            {Array.from({ length: new Date(calPickerYear, calPickerMonth, 1).getDay() }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: new Date(calPickerYear, calPickerMonth + 1, 0).getDate() }, (_, i) => {
              const day = i + 1
              const dateStr = `${calPickerYear}-${String(calPickerMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const isFuture = dateStr > todayStr
              const isToday = dateStr === todayStr
              const isSelected = dateStr === calPickerSelectedDate
              return (
                <button
                  key={day}
                  disabled={isFuture}
                  onClick={() => handleCalPickerDateClick(dateStr)}
                  className={[
                    "h-8 rounded-md text-xs flex items-center justify-center transition-colors w-full",
                    isFuture ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-muted cursor-pointer",
                    isToday && !isSelected ? "font-bold text-primary ring-1 ring-inset ring-primary/40" : "",
                    isSelected ? "bg-primary text-primary-foreground hover:bg-primary font-semibold" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-center text-muted-foreground -mt-1 pb-1">
            Click a date to view its attendance on the main page
          </p>

        </DialogContent>
      </Dialog>

      <AlertDialog open={recordToDelete !== null} onOpenChange={(open) => { if (!open && !deletingId) setRecordToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              {recordToDelete
                ? `This will remove ${recordToDelete.employeeName}'s entry/exit record for ${recordToDelete.attendanceDate}. The employee's fingerprint and device link will not be affected — their next scan will start a fresh cycle.`
                : "This will remove the attendance record. The employee's fingerprint and device link will not be affected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={recordToDelete === null || deletingId !== null}
              onClick={(event) => {
                event.preventDefault()
                if (recordToDelete) {
                  void handleDeleteRow(recordToDelete)
                }
              }}
            >
              {deletingId !== null ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
