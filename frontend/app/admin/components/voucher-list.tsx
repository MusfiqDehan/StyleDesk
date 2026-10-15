"use client"
import { CursorPagination } from "@/components/pagination/cursor-pagination"
import { useLocalCursor } from "@/lib/pagination/use-cursor"
import { Table } from "@/components/ui/table"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  Trash2,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import {
  type Voucher,
  type VoucherDateRange,
  type VoucherType,
  VOUCHER_DATE_RANGES,
  VOUCHER_PAGE_SIZE,
  formatVoucherAmount,
  formatVoucherDisplayDate,
  getDateRangeBounds,
  voucherInRange,
} from "@admin/lib/vouchers"

type TypeFilter = "All Types" | VoucherType

interface VoucherListProps {
  vouchers: Voucher[]
  dateRange: VoucherDateRange
  onDateRangeChange: (range: VoucherDateRange) => void
  onDelete: (id: string) => void
  onPrint: (voucher: Voucher) => void
  onView?: (voucher: Voucher) => void
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
  widthClass = "min-w-[120px]",
}: Readonly<{
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  widthClass?: string
}>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn("relative", widthClass.includes("flex-1") ? "min-w-0 flex-1" : "shrink-0")}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[38px] w-full items-center gap-2 rounded border border-[#f2f2f2] bg-white py-[9px] pl-3 pr-2 text-[14px] font-medium text-[rgba(0,0,0,0.6)] shadow-[0px_4px_60px_0px_rgba(231,231,231,0.48)] transition-colors hover:border-[#dbe3ec] hover:bg-[#fafafa]",
          open && "border-brand-primary/40 ring-2 ring-brand-primary/15",
          widthClass,
        )}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-[#666] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute right-0 z-30 mt-1.5 min-w-full w-max origin-top overflow-hidden rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] transition-all duration-150",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        )}
      >
        {options.map((opt) => {
          const selected = opt === value
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                selected
                  ? "bg-brand-soft text-brand-primary"
                  : "text-[#444] hover:bg-[#f5f7fa]",
              )}
            >
              <span>{opt}</span>
              {selected && <Check className="size-4 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function VoucherList({
  vouchers,
  dateRange,
  onDateRangeChange,
  onDelete,
  onPrint,
  onView,
}: Readonly<VoucherListProps>) {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 250)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All Types")
  const [page, setPage] = useState(1)

  const { from, to } = useMemo(() => getDateRangeBounds(dateRange), [dateRange])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return vouchers.filter((v) => {
      if (!voucherInRange(v.date, from, to)) return false
      if (typeFilter !== "All Types" && v.type !== typeFilter) return false
      if (!q) return true
      return (
        v.voucherNo.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      )
    })
  }, [vouchers, from, to, typeFilter, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / VOUCHER_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const cursorTable = useLocalCursor(filtered, row => row.id)
  const pageRows = cursorTable.data

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, dateRange])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const showingFrom = filtered.length === 0 ? 0 : (safePage - 1) * VOUCHER_PAGE_SIZE + 1
  const showingTo = Math.min(safePage * VOUCHER_PAGE_SIZE, filtered.length)

  return (
    <div className="overflow-hidden rounded-lg border border-[#f2f2f2] bg-white">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-[#f2f2f2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 className="text-[18px] font-medium text-[#333] sm:text-[20px]">Voucher List</h2>

        <div className="flex flex-col gap-2 xs:flex-row sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-[240px] md:w-[280px] lg:w-[335px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vouchers…"
              className="h-[38px] w-full rounded border border-[#f2f2f2] bg-white pl-9 pr-3 text-[14px] font-medium text-[#333] shadow-[0px_4px_60px_0px_rgba(231,231,231,0.48)] outline-none placeholder:text-[#666] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <FilterMenu
              label="Filter by type"
              value={typeFilter}
              options={["All Types", "Income", "Expense"]}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              widthClass="w-full min-w-0 flex-1 sm:min-w-[120px] sm:w-auto sm:flex-none"
            />

            <FilterMenu
              label="Filter by date range"
              value={dateRange}
              options={VOUCHER_DATE_RANGES}
              onChange={(v) => onDateRangeChange(v as VoucherDateRange)}
              widthClass="w-full min-w-0 flex-1 sm:min-w-[140px] sm:w-auto sm:flex-none"
            />
          </div>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <Table cursorPagination={cursorTable} className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-y border-[rgba(0,0,0,0.16)]">
              <th className="px-3 py-2 text-[16px] font-medium text-[#333] first:pl-5">Voucher No</th>
              <th className="px-3 py-2 text-[16px] font-medium text-[#333]">Date</th>
              <th className="px-3 py-2 text-[16px] font-medium text-[#333]">Title</th>
              <th className="px-3 py-2 text-[16px] font-medium text-[#333]">Description</th>
              <th className="px-3 py-2 text-[16px] font-medium text-[#333]">Type</th>
              <th className="px-3 py-2 text-[16px] font-medium text-[#333]">Amount</th>
              <th className="px-3 py-2 pr-5 text-[16px] font-medium text-[#333]">Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-[#666]">
                  No vouchers found for this filter.
                </td>
              </tr>
            ) : (
              pageRows.map((v) => (
                <tr
                  key={v.id}
                  className="cursor-pointer border-b border-[#f2f2f2] transition-colors hover:bg-[#f0f7ff]"
                  onClick={() => onView?.(v)}
                >
                  <td className="truncate px-3 py-2.5 text-[14px] text-[rgba(0,0,0,0.6)] first:pl-5">
                    {v.voucherNo}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[14px] text-[rgba(0,0,0,0.6)]">
                    {formatVoucherDisplayDate(v.date)}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-[14px] text-[rgba(0,0,0,0.6)]" title={v.title}>
                    {v.title}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-[14px] text-[rgba(0,0,0,0.6)]" title={v.description}>
                    {v.description}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex h-7 min-w-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold",
                        v.type === "Expense"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {v.type}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-[14px] font-medium",
                      v.type === "Expense" ? "text-red-500" : "text-[#27b85e]",
                    )}
                  >
                    {formatVoucherAmount(v.type, v.amount)}
                  </td>
                  <td className="px-3 py-2.5 pr-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Print voucher"
                        aria-label={`Print ${v.voucherNo}`}
                        onClick={() => onPrint(v)}
                        className="inline-flex size-[28px] items-center justify-center rounded text-[#999] transition-colors hover:bg-brand-soft hover:text-brand-primary"
                      >
                        <Printer className="size-[18px]" />
                      </button>
                      <button
                        type="button"
                        title="Delete voucher"
                        aria-label={`Delete ${v.voucherNo}`}
                        onClick={() => onDelete(v.id)}
                        className="inline-flex size-[28px] items-center justify-center rounded text-[#999] transition-colors hover:bg-[#fff1f2] hover:text-red-500"
                      >
                        <Trash2 className="size-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Cards — mobile / tablet */}
      <div className="space-y-3 p-4 lg:hidden">
        {pageRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#666]">No vouchers found for this filter.</p>
        ) : (
          pageRows.map((v) => (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => onView?.(v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onView?.(v)
                }
              }}
              className="cursor-pointer rounded-lg border border-[#f2f2f2] bg-[#fafafa] p-3.5 transition-colors hover:bg-[#f0f7ff]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#999]">{v.voucherNo}</p>
                  <p className="mt-0.5 truncate text-[15px] font-medium text-[#333]">{v.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-[#666]">{v.description}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-[14px] font-semibold",
                    v.type === "Expense" ? "text-red-500" : "text-[#27b85e]",
                  )}
                >
                  {formatVoucherAmount(v.type, v.amount)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[#666]">{formatVoucherDisplayDate(v.date)}</span>
                <span
                  className={cn(
                    "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold",
                    v.type === "Expense"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {v.type}
                </span>
                <div className="ml-auto flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Print voucher"
                    aria-label={`Print ${v.voucherNo}`}
                    onClick={() => onPrint(v)}
                    className="inline-flex size-8 items-center justify-center rounded text-[#999] hover:bg-brand-soft hover:text-brand-primary"
                  >
                    <Printer className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    title="Delete voucher"
                    aria-label={`Delete ${v.voucherNo}`}
                    onClick={() => onDelete(v.id)}
                    className="inline-flex size-8 items-center justify-center rounded text-[#999] hover:bg-[#fff1f2] hover:text-red-500"
                  >
                    <Trash2 className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      <CursorPagination pageInfo={cursorTable.pageInfo} onCursorChange={cursorTable.onCursorChange} /></div>

      {/* Pagination — Figma footer */}
      <></>
    </div>
  )
}
