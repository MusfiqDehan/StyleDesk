"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Download, Receipt, Loader2, Pencil, ChevronLeft, ChevronRight, ChevronDown, Users, Calendar as CalendarIcon, Award, Zap, Eye, Search, CheckCircle2, Clock3, User } from "lucide-react"
import {
  getPayrollRecords,
  createPayrollRecord,
  updatePayrollRecord,
  type PayrollRecord,
  type CreatePayrollDto,
  type PayrollStatus,
} from "@admin/api/hr-payroll/hr-payroll"
import { getBasicEmployees } from "@admin/api/employees/employees"
import { StatCard } from "@admin/components/stat-card"
import { useBusiness } from "@/context/BusinessContext"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from '@/lib/toast'
import { formatCurrency, formatMoney, cn } from "@/lib/utils"
import { clearCacheByPrefix, CACHE } from "@admin/lib/cache"
import { AdminPageHeader, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header"
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_VIEW,
  ACTION_EDIT,
  ACTION_SECONDARY,
} from "@admin/lib/table-styles"
// jsPDF is imported dynamically to avoid SSR build errors

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

const PAGE_SIZE = 10

const EMPTY_FORM: CreatePayrollDto = {
  employeeId: "",
  employeeName: "",
  role: "",
  baseSalary: 0,
  bonus: 0,
  deductions: 0,
  netSalary: 0,
  status: "Pending",
  payDate: "",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
}

type MergedRecord = PayrollRecord & { _virtual?: boolean }

export default function HRPayrollPage() {
  const now = new Date()
  // Prefer Asia/Dhaka so last-day / next-month rules match the server
  const dhakaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number)
  const currentYear = dhakaParts[0]
  const currentMonth = dhakaParts[1]
  const currentDay = dhakaParts[2]
  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate()
  const isLastDayOfMonth = currentDay === daysInCurrentMonth
  const nextMonthValue = currentMonth === 12 ? 1 : currentMonth + 1
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear
  /** Furthest month/year the UI may navigate to */
  const maxMonth = isLastDayOfMonth ? nextMonthValue : currentMonth
  const maxYear = isLastDayOfMonth ? nextMonthYear : currentYear

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreatePayrollDto>(EMPTY_FORM)
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; role?: string; salary?: number }>>([])

  const [viewRecord, setViewRecord] = useState<MergedRecord | null>(null)
  const [editRecord, setEditRecord] = useState<MergedRecord | null>(null)
  const [editForm, setEditForm] = useState<CreatePayrollDto>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [addPayDateOpen, setAddPayDateOpen] = useState(false)
  const [editPayDateOpen, setEditPayDateOpen] = useState(false)
  const { businessName } = useBusiness()

  // Auto-calculate netSalary for Create Form
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      netSalary: Number(prev.baseSalary || 0) + Number(prev.bonus || 0) - Number(prev.deductions || 0)
    }))
  }, [form.baseSalary, form.bonus, form.deductions])

  // Auto-calculate netSalary for Edit Form
  useEffect(() => {
    setEditForm(prev => ({
      ...prev,
      netSalary: Number(prev.baseSalary || 0) + Number(prev.bonus || 0) - Number(prev.deductions || 0)
    }))
  }, [editForm.baseSalary, editForm.bonus, editForm.deductions])

  const cursorTable = useRemoteCursor<any>('/payroll', {
    month: selectedMonth, year: selectedYear, search: debouncedSearch || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter, _sort: 'employeeName', _order: 'asc',
  })
  useEffect(() => {
    setRecords(cursorTable.data); setLoading(cursorTable.loading)
    setTotal(cursorTable.pageInfo.total); setPage(cursorTable.pageInfo.page)
  }, [cursorTable.data, cursorTable.loading, cursorTable.pageInfo])
  const fetchPayroll = useCallback(async () => {
    cursorTable.refresh()
    try {
      const list = await getBasicEmployees(true)
      const rows = (Array.isArray(list) ? list : [])
        .filter((e: any) => e?.id && e?.name)
        .filter((e: any) => {
          const status = String(e.status || "ACTIVE").toUpperCase()
          return !e.status || status === "ACTIVE" || status === "PROBATION"
        })
        .map((e: any) => ({
          id: e.id,
          name: e.name,
          role: e.role === "Other" ? e.customRole || e.role : e.role || "",
          salary: Number(e.salary) || 0,
        }))
      setEmployees(rows)
    } catch { toast.error("Error loading employees") }
  }, [cursorTable.refresh])

  useEffect(() => {
    setPage(1)
  }, [selectedMonth, selectedYear, debouncedSearch, statusFilter])

  useEffect(() => {
    clearCacheByPrefix(CACHE.PAYROLL)
    clearCacheByPrefix(CACHE.EMPLOYEES_BASIC)
    fetchPayroll()
  }, [fetchPayroll])

  // Refresh when returning to this tab/page after editing an employee
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      clearCacheByPrefix(CACHE.PAYROLL)
      clearCacheByPrefix(CACHE.EMPLOYEES_BASIC)
      void fetchPayroll()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [fetchPayroll])

  const isAfterMaxPeriod = (month: number, year: number) =>
    year > maxYear || (year === maxYear && month > maxMonth)

  // clamp if somehow past the allowed horizon
  useEffect(() => {
    if (isAfterMaxPeriod(selectedMonth, selectedYear)) {
      setSelectedMonth(maxMonth)
      setSelectedYear(maxYear)
    }
  }, [selectedYear, selectedMonth, maxMonth, maxYear])

  const mergedRecords = useMemo<MergedRecord[]>(() => {
    const empById = new Map(employees.map((e) => [e.id, e]))
    const empByName = new Map(employees.map((e) => [e.name.toLowerCase(), e]))

    const isCurrentOrFuturePeriod =
      selectedYear > currentYear ||
      (selectedYear === currentYear && selectedMonth >= currentMonth)

    // Apply live employee/basic salary to unpaid current + upcoming month rows
    const withLiveSalary = records.map((r) => {
      const emp = (r.employeeId && empById.get(r.employeeId)) || empByName.get(r.employeeName.toLowerCase())
      if (
        !isCurrentOrFuturePeriod ||
        !emp ||
        r.status === "Paid" ||
        Number(emp.salary) <= 0
      ) {
        return r
      }
      const baseSalary = Number(emp.salary) || 0
      const bonus = Number(r.bonus) || 0
      const deductions = Number(r.deductions) || 0
      return {
        ...r,
        baseSalary,
        netSalary: baseSalary + bonus - deductions,
      }
    })

    const byIdAfter = new Map(
      withLiveSalary
        .filter((r) => r.employeeId)
        .map((r) => [r.employeeId, r]),
    )
    const byNameAfter = new Map(
      withLiveSalary.map((r) => [r.employeeName.toLowerCase(), r]),
    )

    // virtual rows only apply to the current month — new employees have no past records
    const isCurrentPeriod = selectedMonth === currentMonth && selectedYear === currentYear
    const statusMatchesPending = statusFilter === "all" || statusFilter === "Pending"

    const missingRows =
      isCurrentPeriod && statusMatchesPending
        ? employees
            .filter((e) => {
              const matchesSearch =
                !debouncedSearch ||
                e.name.toLowerCase().includes(debouncedSearch.toLowerCase())
              const isNotCreated =
                !byIdAfter.has(e.id) && !byNameAfter.has(e.name.toLowerCase())
              return matchesSearch && isNotCreated
            })
            .map((e) => ({
              id: `virtual-${e.id}`,
              employeeId: e.id,
              employeeName: e.name,
              role: e.role || "",
              baseSalary: Number(e.salary) || 0,
              bonus: 0,
              deductions: 0,
              netSalary: Number(e.salary) || 0,
              status: "Pending" as PayrollStatus,
              payDate: "",
              month: selectedMonth,
              year: selectedYear,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _virtual: true,
            }))
        : []

    return [...withLiveSalary, ...missingRows]
  }, [
    records,
    employees,
    selectedMonth,
    selectedYear,
    debouncedSearch,
    statusFilter,
    currentMonth,
    currentYear,
  ])

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {}
    if (!form.employeeId) newErrors.employeeId = "Employee ID is required"
    if (!form.employeeName) newErrors.employeeName = "Employee name is required"
    if (!form.role) newErrors.role = "Role is required"
    if (form.baseSalary <= 0) newErrors.baseSalary = "Base salary must be greater than 0"
    if ((form.bonus ?? 0) < 0) newErrors.bonus = "Bonus cannot be negative"
    if ((form.deductions ?? 0) < 0) newErrors.deductions = "Deductions cannot be negative"
    if (form.status === "Paid" && !form.payDate) newErrors.payDate = "Pay date is required when status is Paid"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors in the form")
      return
    }

    setSaving(true)
    try {
      await createPayrollRecord({ ...form, month: selectedMonth, year: selectedYear })
      toast.success("Payroll record created")
      setIsCreateOpen(false)
      setForm(EMPTY_FORM)
      setErrors({})
      fetchPayroll()
    } catch (error: any) {
      const backendErrors = error.response?.data?.message
      if (Array.isArray(backendErrors)) {
        const newErrors: Record<string, string> = {}
        backendErrors.forEach((msg: string) => {
          if (msg.toLowerCase().includes("salary")) newErrors.baseSalary = msg
          if (msg.toLowerCase().includes("date")) newErrors.payDate = msg
          if (msg.toLowerCase().includes("id")) newErrors.employeeId = msg
          if (msg.toLowerCase().includes("name")) newErrors.employeeName = msg
          if (msg.toLowerCase().includes("role")) newErrors.role = msg
        })
        setErrors(newErrors)
      }

      const errorMessage = Array.isArray(backendErrors) ? backendErrors[0] : backendErrors
      toast.error(typeof errorMessage === 'string' && errorMessage !== "Internal server error" ? errorMessage : "Failed to create payroll record")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (record: MergedRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditRecord(record)
    setEditForm({
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      role: record.role,
      baseSalary: Number(record.baseSalary),
      bonus: Number(record.bonus),
      deductions: Number(record.deductions),
      netSalary: Number(record.netSalary),
      status: record.status,
      payDate: record.payDate ?? "",
      month: record.month,
      year: record.year,
    })
  }

  const handleEditSave = async () => {
    if (!editRecord) return

    const newErrors: Record<string, string> = {}
    if ((editForm.bonus ?? 0) < 0) newErrors.bonus = "Bonus cannot be negative"
    if ((editForm.deductions ?? 0) < 0) newErrors.deductions = "Deductions cannot be negative"
    if (editForm.status === "Paid" && !editForm.payDate) newErrors.payDate = "Pay date is required when status is Paid"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors in the form")
      return
    }

    setEditSaving(true)
    try {
      if (editRecord._virtual) {
        await createPayrollRecord({ ...editForm, month: selectedMonth, year: selectedYear })
        toast.success("Payroll record saved")
      } else {
        await updatePayrollRecord(editRecord.id, editForm)
        toast.success("Payroll record updated")
      }
      setEditRecord(null)
      setErrors({})
      fetchPayroll()
    } catch (error: any) {
      const backendErrors = error.response?.data?.message
      if (Array.isArray(backendErrors)) {
        const newErrors: Record<string, string> = {}
        backendErrors.forEach((msg: string) => {
          if (msg.toLowerCase().includes("salary")) newErrors.baseSalary = msg
          if (msg.toLowerCase().includes("date")) newErrors.payDate = msg
        })
        setErrors(newErrors)
      }

      const errorMessage = Array.isArray(backendErrors) ? backendErrors[0] : backendErrors
      toast.error(typeof errorMessage === 'string' && errorMessage !== "Internal server error" ? errorMessage : "Failed to save payroll record")
    } finally {
      setEditSaving(false)
    }
  }

  const downloadPayrollSlip = async (record: PayrollRecord) => {
    if (typeof window === 'undefined') return
    // Dynamically import browser-compatible version of jsPDF to avoid SSR issues
    const { default: jsPDF } = await import("jspdf/dist/jspdf.es.min.js")
    const { default: autoTable } = await (import("jspdf-autotable") as any)

    const doc = new (jsPDF as any)()
    const monthName = MONTHS.find((m) => m.value === record.month)?.label || "Month"

    // Set header
    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text(`${businessName} Salary Slip`, 105, 20, { align: "center" })

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Period: ${monthName} ${record.year}`, 105, 28, { align: "center" })

    // Employee Details
    const details = [
      ["Employee Name", record.employeeName],
      ["Employee ID", record.employeeId],
      ["Role", record.role],
      ["Status", record.status],
      ["Pay Date", record.payDate || "N/A"],
    ]

    autoTable(doc, {
      startY: 40,
      head: [["Description", "Details"]],
      body: details,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229] },
    })

    // Salary Breakdown
    const salaryData = [
      ["Base Salary", `BDT ${formatMoney(record.baseSalary)}`],
      ["Bonus", `BDT ${formatMoney(record.bonus)}`],
      ["Deductions", `BDT ${formatMoney(record.deductions)}`],
      ["Net Salary", `BDT ${formatMoney(record.netSalary)}`],
    ]

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Earnings/Deductions", "Amount"]],
      body: salaryData,
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129] },
      columnStyles: { 1: { halign: "right" } },
    })

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 30
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text("________________________", 40, finalY)
    doc.text("Employee Signature", 40, finalY + 5)

    doc.text("________________________", 140, finalY)
    doc.text("Authorized Signature", 140, finalY + 5)

    doc.setFontSize(8)
    doc.text("This is a computer generated document and does not require a physical signature.", 105, finalY + 20, { align: "center" })

    doc.save(`SalarySlip_${businessName}_${record.employeeName}_${monthName}_${record.year}.pdf`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "border-emerald-200 bg-emerald-50 text-emerald-700"
      case "Pending":
      case "Processing":
        return "border-amber-200 bg-amber-50 text-amber-700"
      default: return "border-[#e7e7e7] bg-[#f8fafc] text-[#555]"
    }
  }

  const normalizeStatus = (status?: PayrollStatus): PayrollStatus =>
    !status || status === "Processing" ? "Pending" : status

  const todayPayDate = () => format(new Date(), "yyyy-MM-dd")

  const resolvePayDate = (status: PayrollStatus, currentPayDate?: string | null) => {
    if (status === "Paid") return currentPayDate || todayPayDate()
    if (status === "Pending") return ""
    return currentPayDate || ""
  }

  const handleStatusChange = async (record: MergedRecord, status: PayrollStatus) => {
    const nextStatus = normalizeStatus(status)
    if (normalizeStatus(record.status) === nextStatus && !record._virtual) return

    const payDate = resolvePayDate(nextStatus, record.payDate)
    setStatusUpdatingId(record.id)
    try {
      if (record._virtual) {
        await createPayrollRecord({
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          role: record.role,
          baseSalary: Number(record.baseSalary) || 0,
          bonus: Number(record.bonus) || 0,
          deductions: Number(record.deductions) || 0,
          netSalary: Number(record.netSalary) || 0,
          status: nextStatus,
          payDate,
          month: selectedMonth,
          year: selectedYear,
        })
      } else {
        await updatePayrollRecord(record.id, {
          status: nextStatus,
          payDate: nextStatus === "Paid" ? payDate : "",
        })
      }
      toast.success(
        nextStatus === "Paid"
          ? `${record.employeeName} marked as Paid — added to Finance`
          : `${record.employeeName} marked as Pending — removed from Finance`,
      )
      await fetchPayroll()
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update payroll status",
      )
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleBulkStatus = async (status: PayrollStatus) => {
    const nextStatus = normalizeStatus(status)
    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label ?? selectedMonth
    if (
      !window.confirm(
        `Mark all payroll records for ${monthLabel} ${selectedYear} as ${nextStatus}?`,
      )
    ) {
      return
    }

    setBulkUpdating(true)
    try {
      const res = await getPayrollRecords(
        selectedMonth,
        selectedYear,
        1,
        1000,
        undefined,
        undefined,
      )
      const existing = res.data ?? []
      const payDateForBulk = nextStatus === "Paid" ? todayPayDate() : ""

      await Promise.all(
        existing.map((record) =>
          updatePayrollRecord(record.id, {
            status: nextStatus,
            payDate:
              nextStatus === "Paid"
                ? resolvePayDate("Paid", record.payDate || payDateForBulk)
                : "",
          }),
        ),
      )

      // Current-period employees without a payroll row yet (virtual Pending rows)
      const isCurrentPeriod =
        selectedMonth === currentMonth && selectedYear === currentYear
      if (isCurrentPeriod && nextStatus === "Paid") {
        const existingNames = new Set(
          existing.map((r) => r.employeeName.toLowerCase()),
        )
        const missing = employees.filter(
          (e) => !existingNames.has(e.name.toLowerCase()),
        )
        await Promise.all(
          missing.map((e) =>
            createPayrollRecord({
              employeeId: e.id,
              employeeName: e.name,
              role: e.role || "",
              baseSalary: Number(e.salary) || 0,
              bonus: 0,
              deductions: 0,
              netSalary: Number(e.salary) || 0,
              status: nextStatus,
              payDate: payDateForBulk,
              month: selectedMonth,
              year: selectedYear,
            }),
          ),
        )
      }

      toast.success(
        nextStatus === "Paid"
          ? `All records marked as Paid — added to Finance`
          : `All records marked as Pending — removed from Finance`,
      )
      await fetchPayroll()
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update payroll statuses",
      )
    } finally {
      setBulkUpdating(false)
    }
  }

  // All stats derived from mergedRecords so they update when month/year changes
  const totalPayroll = mergedRecords.reduce((sum, r) => sum + Number(r.netSalary), 0)
  const totalBonus = mergedRecords.reduce((sum, r) => sum + Number(r.bonus), 0)
  const monthEmployeeCount = mergedRecords.length
  const topBonusEarner = mergedRecords.length > 0
    ? mergedRecords.reduce((top, r) => Number(r.bonus) > Number(top.bonus) ? r : top, mergedRecords[0])
    : null
  const topBonusName = topBonusEarner && Number(topBonusEarner.bonus) > 0 ? topBonusEarner.employeeName : null

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const atMaxPeriod =
    selectedMonth === maxMonth && selectedYear === maxYear
  const atMaxYear = selectedYear >= maxYear

  return (
    <div className={DASH_PAGE}>

      <AdminPageHeader
        title="Manage Payrolls"
        subtitle="Process salaries, commissions, and employee bonuses"
        actions={
          <AdminHeaderSecondaryButton accessAction="export">
            <Download />
            Export
          </AdminHeaderSecondaryButton>
        }
      />

      {/* Month / Year Filter */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Month navigator */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="w-24 text-center text-sm font-medium">
            {MONTHS.find((m) => m.value === selectedMonth)?.label}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={nextMonth}
            disabled={atMaxPeriod}
            title={
              isLastDayOfMonth
                ? "Next month payroll is available on the last day of the month"
                : "Next month unlocks on the last day of this month"
            }
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Year navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="w-24 text-center text-sm font-medium">{selectedYear}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={atMaxYear}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {isLastDayOfMonth && (
          <p className="text-xs text-muted-foreground">
            Last day of the month — next month payroll is available with updated salaries
          </p>
        )}
      </div>

      {/* Summary Cards — all values are scoped to the selected month/year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <StatCard
          title="Total Payroll"
          value={formatCurrency(totalPayroll)}
          subtitle={`${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
          icon={Receipt}
          iconWrapperClassName="bg-brand-soft text-brand-primary"
          className="border-t-4 border-t-transparent hover:border-t-blue-500 transition-all"
        />
        <StatCard
          title="Total Employees"
          value={monthEmployeeCount}
          subtitle="Active this month"
          icon={Users}
          iconWrapperClassName="bg-emerald-50 text-emerald-500"
          className="border-t-4 border-t-transparent hover:border-t-emerald-500 transition-all"
        />
        <StatCard
          title="Top Bonus Earner"
          value={topBonusName ?? "—"}
          subtitle={topBonusEarner && Number(topBonusEarner.bonus) > 0
            ? `${formatCurrency(Number(topBonusEarner.bonus))} bonus`
            : "No bonuses this month"}
          icon={Award}
          iconWrapperClassName="bg-amber-50 text-amber-500"
          className="border-t-4 border-t-transparent hover:border-t-amber-500 transition-all"
        />
        <StatCard
          title="Total Bonus"
          value={formatCurrency(totalBonus)}
          subtitle="Commission & bonuses paid"
          icon={Zap}
          iconWrapperClassName="bg-violet-50 text-violet-500"
          className="border-t-4 border-t-transparent hover:border-t-violet-500 transition-all"
        />
      </div>

      {/* Payroll Table */}
      <div className={TABLE_CARD_CLASS}>
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
              <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={SEARCH_INPUT_CLASS}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={cn(FILTER_TRIGGER, "w-full sm:w-[150px]")}>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                <SelectItem value="all" className="rounded-lg text-sm">All Status</SelectItem>
                <SelectItem value="Paid" className="rounded-lg text-sm">Paid</SelectItem>
                <SelectItem value="Pending" className="rounded-lg text-sm">Pending</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-[38px] rounded-lg border-[#e7e7e7] px-3 text-sm font-medium shadow-none",
                  bulkMenuOpen && "border-brand-primary bg-brand-mist text-brand-primary",
                )}
                disabled={bulkUpdating || loading}
                aria-expanded={bulkMenuOpen}
                onClick={() => setBulkMenuOpen((open) => !open)}
              >
                {bulkUpdating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Bulk Status
                <ChevronDown
                  className={cn(
                    "ml-2 size-4 opacity-60 transition-transform",
                    bulkMenuOpen && "rotate-180",
                  )}
                />
              </Button>

              {bulkMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close bulk status menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setBulkMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute left-0 top-[calc(100%+6px)] z-50 w-[220px] overflow-hidden rounded-xl border border-[#e7e7e7] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
                  >
                    <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#999]">
                      Apply to this month
                    </p>
                    {(
                      [
                        {
                          status: "Paid" as PayrollStatus,
                          label: "Mark all Paid",
                          hint: "Set pay date today",
                          icon: CheckCircle2,
                          iconClass: "text-emerald-600",
                          iconBg: "bg-emerald-50",
                        },
                        {
                          status: "Pending" as PayrollStatus,
                          label: "Mark all Pending",
                          hint: "Undo paid & remove from Finance",
                          icon: Clock3,
                          iconClass: "text-amber-600",
                          iconBg: "bg-amber-50",
                        },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon
                      return (
                        <button
                          key={option.status}
                          type="button"
                          role="menuitem"
                          disabled={bulkUpdating}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-brand-mist disabled:opacity-50"
                          onClick={() => {
                            setBulkMenuOpen(false)
                            void handleBulkStatus(option.status)
                          }}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg",
                              option.iconBg,
                            )}
                          >
                            <Icon className={cn("size-4", option.iconClass)} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#333]">
                              {option.label}
                            </span>
                            <span className="block text-[11px] text-[#888]">
                              {option.hint}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${total} results`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={HEAD_CLASS}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Employee</TableHead>
                <TableHead className={cn(HEAD_CLASS, "hidden sm:table-cell")}>Role</TableHead>
                <TableHead className={cn(HEAD_CLASS, "hidden md:table-cell")}>Base Salary</TableHead>
                <TableHead className={cn(HEAD_CLASS, "hidden md:table-cell")}>Bonus</TableHead>
                <TableHead className={cn(HEAD_CLASS, "hidden md:table-cell")}>Deductions</TableHead>
                <TableHead className={HEAD_CLASS}>Net Salary</TableHead>
                <TableHead className={HEAD_CLASS}>Status</TableHead>
                <TableHead className={HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                    Loading payroll records...
                  </TableCell>
                </TableRow>
              ) : mergedRecords.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                    No payroll records for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </TableCell>
                </TableRow>
              ) : (
                mergedRecords.map((record, index) => (
                  <TableRow
                    key={record.id}
                    className={cn(TABLE_ROW_CLASS, "cursor-pointer")}
                    onClick={() => setViewRecord(record)}
                  >
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Avatar className="h-8 w-8 shrink-0 sm:h-10 sm:w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <User className="size-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="max-w-[120px] truncate font-medium sm:max-w-none">{record.employeeName}</p>
                          <p className="text-xs text-muted-foreground">{record.employeeId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "hidden sm:table-cell")}>{record.role}</TableCell>
                    <TableCell className={cn(CELL_CLASS, "hidden md:table-cell tabular-nums")}>{formatCurrency(record.baseSalary)}</TableCell>
                    <TableCell className={cn(CELL_CLASS, "hidden md:table-cell tabular-nums text-emerald-600")}>+{formatCurrency(record.bonus)}</TableCell>
                    <TableCell className={cn(CELL_CLASS, "hidden md:table-cell tabular-nums text-rose-600")}>-{formatCurrency(record.deductions)}</TableCell>
                    <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>{formatCurrency(record.netSalary)}</TableCell>
                    <TableCell
                      className={CELL_CLASS}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={normalizeStatus(record.status)}
                        disabled={
                          statusUpdatingId === record.id || bulkUpdating
                        }
                        onValueChange={(value) =>
                          void handleStatusChange(record, value as PayrollStatus)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-7 w-[124px] rounded-full border px-2.5 text-[11px] font-semibold shadow-none focus:ring-0 focus:ring-offset-0",
                            getStatusColor(record.status),
                          )}
                        >
                          {statusUpdatingId === record.id ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="size-3 animate-spin" />
                              Saving
                            </span>
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                          <SelectItem value="Pending" className="rounded-lg text-sm">
                            Pending
                          </SelectItem>
                          <SelectItem value="Paid" className="rounded-lg text-sm">
                            Paid
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={CELL_CLASS} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_VIEW}
                          aria-label="View payroll"
                          onClick={() => setViewRecord(record)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_EDIT}
                          aria-label="Edit payroll"
                          onClick={(e) => openEdit(record, e)}
                         accessAction="edit">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_SECONDARY}
                          aria-label="Download slip"
                          onClick={() => downloadPayrollSlip(record)}
                         accessAction="export">
                          <Download className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <></>
        )}
      </div>

      {/* Create Payroll Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) setErrors({}) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 pb-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={errors.employeeId ? "text-destructive" : ""}>Employee ID <span className="text-destructive">*</span></Label>
                <Input
                  className={errors.employeeId ? "border-destructive" : ""}
                  value={form.employeeId}
                  onChange={(e) => {
                    setForm({ ...form, employeeId: e.target.value })
                    if (errors.employeeId) setErrors(prev => ({ ...prev, employeeId: "" }))
                  }}
                  placeholder="EMP001"
                />
                {errors.employeeId && <p className="text-[10px] text-destructive mt-1">{errors.employeeId}</p>}
              </div>
              <div>
                <Label className={errors.employeeName ? "text-destructive" : ""}>Employee Name <span className="text-destructive">*</span></Label>
                <Input
                  className={errors.employeeName ? "border-destructive" : ""}
                  value={form.employeeName}
                  onChange={(e) => {
                    setForm({ ...form, employeeName: e.target.value })
                    if (errors.employeeName) setErrors(prev => ({ ...prev, employeeName: "" }))
                  }}
                  placeholder="e.g. Alex Rahman"
                />
                {errors.employeeName && <p className="text-[10px] text-destructive mt-1">{errors.employeeName}</p>}
              </div>
            </div>
            <div>
              <Label className={errors.role ? "text-destructive" : ""}>Role <span className="text-destructive">*</span></Label>
              <Input
                className={errors.role ? "border-destructive" : ""}
                value={form.role}
                onChange={(e) => {
                  setForm({ ...form, role: e.target.value })
                  if (errors.role) setErrors(prev => ({ ...prev, role: "" }))
                }}
                placeholder="e.g. Senior Artist"
              />
              {errors.role && <p className="text-[10px] text-destructive mt-1">{errors.role}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={errors.baseSalary ? "text-destructive" : ""}>Base Salary <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. 25000"
                  className={errors.baseSalary ? "border-destructive" : ""}
                  type="number"
                  min={0}
                  value={form.baseSalary}
                  onChange={(e) => {
                    setForm({ ...form, baseSalary: Number(e.target.value) })
                    if (errors.baseSalary) setErrors(prev => ({ ...prev, baseSalary: "" }))
                  }}
                />
                {errors.baseSalary && <p className="text-[10px] text-destructive mt-1">{errors.baseSalary}</p>}
              </div>
              <div>
                <Label className={errors.bonus ? "text-destructive" : ""}>Bonus</Label>
                <Input placeholder="e.g. 1000"
                  className={errors.bonus ? "border-destructive" : ""}
                  type="number"
                  min={0}
                  value={form.bonus}
                  onChange={(e) => {
                    setForm({ ...form, bonus: Number(e.target.value) })
                    if (errors.bonus) setErrors(prev => ({ ...prev, bonus: "" }))
                  }}
                />
                {errors.bonus && <p className="text-[10px] text-destructive mt-1">{errors.bonus}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={errors.deductions ? "text-destructive" : ""}>Deductions</Label>
                <Input placeholder="e.g. 1000"
                  className={errors.deductions ? "border-destructive" : ""}
                  type="number"
                  min={0}
                  value={form.deductions}
                  onChange={(e) => {
                    setForm({ ...form, deductions: Number(e.target.value) })
                    if (errors.deductions) setErrors(prev => ({ ...prev, deductions: "" }))
                  }}
                />
                {errors.deductions && <p className="text-[10px] text-destructive mt-1">{errors.deductions}</p>}
              </div>
              <div>
                <Label>Net Salary</Label>
                <Input placeholder="e.g. 25000"
                  type="number"
                  min={0}
                  value={form.netSalary}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => {
                    setForm({ ...form, status: v as PayrollStatus })
                    if (v !== "Paid" && errors.payDate) setErrors(prev => ({ ...prev, payDate: "" }))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={errors.payDate ? "text-destructive" : ""}>Pay Date {form.status === "Paid" && <span className="text-destructive">*</span>}</Label>
                <Popover open={addPayDateOpen} onOpenChange={setAddPayDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full justify-start px-3 font-normal${errors.payDate ? " border-destructive" : ""}`}
                     accessAction="create">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className={form.payDate ? "text-foreground" : "text-muted-foreground"}>
                        {form.payDate ? format(new Date(`${form.payDate}T00:00:00`), "PPP") : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                    <DateCalendar
                      mode="single"
                      selected={form.payDate ? new Date(`${form.payDate}T00:00:00`) : undefined}
                      onSelect={(selected) => {
                        if (!selected) return
                        setForm({ ...form, payDate: format(selected, "yyyy-MM-dd") })
                        if (errors.payDate) setErrors(prev => ({ ...prev, payDate: "" }))
                        setAddPayDateOpen(false)
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.payDate && <p className="text-[10px] text-destructive mt-1">{errors.payDate}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setErrors({}) }} className="w-full">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="w-full" accessAction="create">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payroll Details</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4 py-2 pb-2">
              <div className="flex items-center gap-3 border-b pb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{viewRecord.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{viewRecord.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Employee ID</p>
                  <p className="font-medium">{viewRecord.employeeId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Period</p>
                  <p className="font-medium">{MONTHS.find(m => m.value === viewRecord.month)?.label} {viewRecord.year}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Base Salary</p>
                  <p className="font-medium">{formatCurrency(viewRecord.baseSalary)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Bonus</p>
                  <p className="font-medium text-green-600">+{formatCurrency(viewRecord.bonus)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Deductions</p>
                  <p className="font-medium text-red-600">-{formatCurrency(viewRecord.deductions)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Net Salary</p>
                  <p className="font-semibold text-base">{formatCurrency(viewRecord.netSalary)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewRecord.status)}`}>
                    {viewRecord.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Pay Date</p>
                  <p className="font-medium">{viewRecord.payDate || "—"}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => downloadPayrollSlip(viewRecord)} className="w-full" accessAction="export">
                  <Download className="w-4 h-4 mr-2" />
                  Download Slip
                </Button>
                <Button variant="outline" onClick={() => { setViewRecord(null); openEdit(viewRecord, { stopPropagation: () => { } } as any) }} className="w-full" accessAction="edit">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {/* <Button onClick={() => setViewRecord(null)} className="w-full">Close</Button> */}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) { setEditRecord(null); setErrors({}); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payroll — {editRecord?.employeeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 pb-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Salary</Label>
                <Input placeholder="e.g. 25000"
                  type="text"
                  inputMode="decimal"
                  value={editForm.baseSalary}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <Label className={errors.bonus ? "text-destructive" : ""}>Bonus</Label>
                <Input placeholder="e.g. 1000"
                  className={errors.bonus ? "border-destructive" : ""}
                  type="text"
                  inputMode="decimal"
                  value={editForm.bonus ? String(editForm.bonus) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, "")
                    setEditForm({ ...editForm, bonus: raw === "" ? 0 : Number(raw) })
                    if (errors.bonus) setErrors(prev => ({ ...prev, bonus: "" }))
                  }}
                />
                {errors.bonus && <p className="text-[10px] text-destructive mt-1">{errors.bonus}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={errors.deductions ? "text-destructive" : ""}>Deductions</Label>
                <Input placeholder="e.g. 1000"
                  className={errors.deductions ? "border-destructive" : ""}
                  type="text"
                  inputMode="decimal"
                  value={editForm.deductions ? String(editForm.deductions) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, "")
                    setEditForm({ ...editForm, deductions: raw === "" ? 0 : Number(raw) })
                    if (errors.deductions) setErrors(prev => ({ ...prev, deductions: "" }))
                  }}
                />
                {errors.deductions && <p className="text-[10px] text-destructive mt-1">{errors.deductions}</p>}
              </div>
              <div>
                <Label>Net Salary</Label>
                <Input placeholder="e.g. 25000"
                  type="text"
                  inputMode="decimal"
                  value={editForm.netSalary}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <Label>Status</Label>
                <Select
                  value={normalizeStatus(editForm.status)}
                  onValueChange={(v) => {
                    setEditForm({ ...editForm, status: v as PayrollStatus })
                    if (v !== "Paid" && errors.payDate) setErrors(prev => ({ ...prev, payDate: "" }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className={errors.payDate ? "text-destructive" : ""}>Pay Date {editForm.status === "Paid" && <span className="text-destructive">*</span>}</Label>
                <Popover open={editPayDateOpen} onOpenChange={setEditPayDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full justify-start px-3 font-normal${errors.payDate ? " border-destructive" : ""}`}
                     accessAction="create">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className={editForm.payDate ? "text-foreground" : "text-muted-foreground"}>
                        {editForm.payDate ? format(new Date(`${editForm.payDate}T00:00:00`), "PPP") : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                    <DateCalendar
                      mode="single"
                      selected={editForm.payDate ? new Date(`${editForm.payDate}T00:00:00`) : undefined}
                      onSelect={(selected) => {
                        if (!selected) return
                        setEditForm({ ...editForm, payDate: format(selected, "yyyy-MM-dd") })
                        if (errors.payDate) setErrors(prev => ({ ...prev, payDate: "" }))
                        setEditPayDateOpen(false)
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.payDate && <p className="text-[10px] text-destructive mt-1">{errors.payDate}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRecord(null); setErrors({}) }} className="w-full">
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="w-full" accessAction="edit">
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
