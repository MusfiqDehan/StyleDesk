"use client"
import { CursorPagination } from "@/components/pagination/cursor-pagination"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"
import { Table } from "@/components/ui/table"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "@/lib/toast"
import {
  deleteFinanceEntry,
  getFinanceMonthlySummary,
  getFinanceTransactions,
  type FinanceMonthlySummary,
  type FinanceTransaction,
  type FinanceTransactionType,
} from "@admin/api/finance/finance"

type FinanceTab = "transactions" | "yearly-summary"

const TYPE_OPTIONS: { value: FinanceTransactionType; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
]

const TX_PAGE_SIZE = 10

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

function monthDateRange(year: number, month: number) {
  const m = String(month).padStart(2, "0")
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${m}-01`,
    to: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
  }
}

function formatTk(value: number, signed = false) {
  const abs = Math.abs(value || 0)
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)
  if (signed && value < 0) return `-Tk.${formatted}`
  return `Tk.${formatted}`
}

function formatCell(value: number, tone: "income" | "expense" | "net") {
  if (!value) return <span className="text-[#333]">-</span>
  if (tone === "net") {
    const cls = value < 0 ? "text-red-500" : "text-[#27b85e]"
    return (
      <span className={cn("font-medium", cls)}>
        {formatTk(value, true)}
      </span>
    )
  }
  return (
    <span className={cn("font-medium", tone === "income" ? "text-[#27b85e]" : "text-red-500")}>
      {formatTk(value)}
    </span>
  )
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
  widthClass = "min-w-[100px]",
}: Readonly<{
  label: string
  value: string
  options: { value: string; label: string }[]
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

  const current = options.find((o) => o.value === value)?.label ?? value

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[38px] items-center gap-2 rounded border border-[#f2f2f2] bg-white py-2 pl-3 pr-2 text-[14px] font-medium text-[rgba(0,0,0,0.6)] transition-colors hover:border-[#dbe3ec] hover:bg-[#fafafa]",
          open && "border-brand-primary/40 ring-2 ring-brand-primary/15",
          widthClass,
        )}
      >
        <span className="truncate">{current}</span>
        <ChevronDown className={cn("size-5 shrink-0 text-[#666] transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "absolute right-0 z-30 mt-1.5 min-w-full w-max origin-top overflow-hidden rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] transition-all duration-150",
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        )}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
              opt.value === value ? "bg-brand-soft text-brand-primary" : "text-[#444] hover:bg-[#f5f7fa]",
            )}
          >
            <span>{opt.label}</span>
            {opt.value === value && <Check className="size-4 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  )
}

interface SummaryTableProps {
  title: string
  titleColor: string
  headerBorder: string
  footerBg: string
  rows: Array<{ label: string; months: number[]; total: number; isTotal?: boolean }>
  tone: "income" | "expense" | "net"
  monthLabels: string[]
}

function SummaryTable({
  title,
  titleColor,
  headerBorder,
  footerBg,
  rows,
  tone,
  monthLabels,
}: Readonly<SummaryTableProps>) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-2 py-2">
        <h3 className={cn("text-[18px] font-medium sm:text-[20px]", titleColor)}>{title}</h3>
        <p className="text-[11px] text-[#999] sm:hidden">Swipe sideways to see all months</p>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Table className="w-full min-w-[720px] border-collapse text-left text-[11px] sm:table-fixed sm:min-w-0 sm:text-[12px]">
          <colgroup className="hidden sm:table-column-group">
            <col className="w-[11%]" />
            {monthLabels.map((m) => (
              <col key={m} className="w-[6.5%]" />
            ))}
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className={cn("border-y font-medium text-[#333]", headerBorder)}>
              <th className="whitespace-nowrap px-1 py-2 pr-2 sm:px-0">Month</th>
              {monthLabels.map((m) => (
                <th key={m} className="whitespace-nowrap px-1 py-2 sm:px-0">
                  {m}
                </th>
              ))}
              <th className="whitespace-nowrap px-1 py-2 sm:px-0">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={cn(
                  "border-t border-[rgba(0,0,0,0.16)]",
                  row.isTotal && footerBg,
                  row.isTotal && headerBorder,
                )}
              >
                <td className={cn("py-2 pr-2 font-medium text-[#333]", row.isTotal && "font-semibold")}>
                  {row.label}
                </td>
                {row.months.map((val, idx) => (
                  <td key={`${row.label}-${idx}`} className="py-2">
                    {row.isTotal ? (
                      <span
                        className={cn(
                          "font-semibold",
                          tone === "income"
                            ? "text-[#27b85e]"
                            : tone === "expense"
                              ? "text-red-500"
                              : val < 0
                                ? "text-red-500"
                                : "text-[#27b85e]",
                        )}
                      >
                        {val ? formatTk(val, tone === "net") : "-"}
                      </span>
                    ) : (
                      formatCell(val, tone)
                    )}
                  </td>
                ))}
                <td className="py-2">
                  <span
                    className={cn(
                      "font-medium",
                      row.isTotal && "font-semibold",
                      tone === "income"
                        ? "text-[#27b85e]"
                        : tone === "expense"
                          ? "text-red-500"
                          : row.total < 0
                            ? "text-red-500"
                            : "text-[#27b85e]",
                    )}
                  >
                    {row.total ? formatTk(row.total, tone === "net") : tone === "net" ? formatTk(0) : "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

interface FinanceLedgerPanelProps {
  refreshKey?: number
  className?: string
  year?: number
  onChanged?: () => void
}

export function FinanceLedgerPanel({
  refreshKey = 0,
  className,
  year,
  onChanged,
}: Readonly<FinanceLedgerPanelProps>) {
  const [tab, setTab] = useState<FinanceTab>("yearly-summary")
  const [summary, setSummary] = useState<FinanceMonthlySummary | null>(null)
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [txPages, setTxPages] = useState(1)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingTx, setLoadingTx] = useState(true)

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [typeFilter, setTypeFilter] = useState<FinanceTransactionType>("all")

  const viewYear = year ?? new Date().getFullYear()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  /** Selected month for Transactions tab (1–12). Defaults to current month. */
  const [txMonth, setTxMonth] = useState(() =>
    year && year !== currentYear ? 12 : currentMonth,
  )

  const monthOptions = useMemo(() => {
    if (viewYear < currentYear) return MONTH_OPTIONS
    if (viewYear > currentYear) return []
    return MONTH_OPTIONS.filter((o) => Number(o.value) <= currentMonth)
  }, [viewYear, currentYear, currentMonth])

  useEffect(() => {
    // Keep month in range when year changes
    const maxMonth = viewYear === currentYear ? currentMonth : 12
    setTxMonth((prev) => {
      if (viewYear === currentYear) return Math.min(prev, currentMonth) || currentMonth
      if (prev > maxMonth) return maxMonth
      return prev || maxMonth
    })
  }, [viewYear, currentYear, currentMonth])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      // Always bypass cache — income/expense must reflect payments instantly
      const data = await getFinanceMonthlySummary(viewYear, true)
      setSummary(data)
    } catch {
      toast.error("Failed to load yearly summary")
      setSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }, [viewYear])

  const cursorTable = useRemoteCursor<FinanceTransaction>('/finance/transactions', {
    search: debouncedSearch || undefined, type: typeFilter,
    ...monthDateRange(viewYear, txMonth), _sort: 'date', _order: 'desc',
  }, tab === 'transactions')
  useEffect(() => {
    setTransactions(cursorTable.data); setLoadingTx(cursorTable.loading)
    setTxTotal(cursorTable.pageInfo.total); setTxPage(cursorTable.pageInfo.page)
  }, [cursorTable.data, cursorTable.loading, cursorTable.pageInfo])
  const loadTransactions = useCallback(async () => cursorTable.refresh(), [cursorTable.refresh])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary, refreshKey])

  useEffect(() => {
    if (tab !== "transactions") return
    void loadTransactions()
  }, [loadTransactions, refreshKey, tab])

  useEffect(() => {
    setTxPage(1)
  }, [debouncedSearch, typeFilter, tab, viewYear, txMonth])

  const monthLabels = summary?.months.map((m) => m.label) ?? [
    "Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]

  const filteredIncomeRows = useMemo(() => {
    if (!summary) return []
    const q = debouncedSearch.trim().toLowerCase()
    return summary.income.categories.filter((row) => {
      if (typeFilter === "expense") return false
      if (!q) return true
      return row.label.toLowerCase().includes(q)
    })
  }, [summary, debouncedSearch, typeFilter])

  const filteredExpenseRows = useMemo(() => {
    if (!summary) return []
    const q = debouncedSearch.trim().toLowerCase()
    return summary.expense.categories.filter((row) => {
      if (typeFilter === "income") return false
      if (!q) return true
      return row.label.toLowerCase().includes(q)
    })
  }, [summary, debouncedSearch, typeFilter])

  const handleDelete = async (tx: FinanceTransaction) => {
    if (tx.source !== "ledger") {
      toast.error("Invoice transactions cannot be deleted here")
      return
    }
    if (!window.confirm(`Delete "${tx.title}"?`)) return
    try {
      await deleteFinanceEntry(tx.id)
      toast.success("Entry deleted")
      await loadSummary()
      await loadTransactions()
      onChanged?.()
    } catch {
      toast.error("Failed to delete entry")
    }
  }

  const yearLabel = String(summary?.year ?? viewYear)

  return (
    <div
      className={cn(
        "mt-5 overflow-hidden rounded-lg border border-[#f2f2f2] bg-white p-4 sm:p-5",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex w-full items-center rounded border border-[#f2f2f2] bg-white p-[7px] shadow-[0px_4px_30px_rgba(231,231,231,0.48)] sm:w-fit">
          <button
            type="button"
            onClick={() => setTab("transactions")}
            className={cn(
              "flex-1 rounded-[2px] px-2 py-1.5 text-[13px] font-medium transition-colors sm:flex-none sm:text-[14px]",
              tab === "transactions" ? "bg-brand-primary text-white" : "text-black hover:bg-brand-mist",
            )}
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setTab("yearly-summary")}
            className={cn(
              "flex-1 rounded-[2px] px-2 py-1.5 text-[13px] font-medium transition-colors sm:flex-none sm:text-[14px]",
              tab === "yearly-summary" ? "bg-brand-primary text-white" : "text-black hover:bg-brand-mist",
            )}
          >
            Yearly Summary
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-[280px] lg:w-[335px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, categories & amount"
              className="h-[38px] w-full rounded border border-[#f2f2f2] bg-white pl-9 pr-3 text-[14px] font-medium text-[#333] shadow-[0px_4px_60px_0px_rgba(231,231,231,0.48)] outline-none placeholder:text-[#666] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            />
          </div>
          {tab === "transactions" && monthOptions.length > 0 && (
            <FilterMenu
              label="Select month"
              value={String(txMonth)}
              options={monthOptions}
              onChange={(v) => setTxMonth(Number(v))}
              widthClass="min-w-[140px]"
            />
          )}
          <FilterMenu
            label="Filter by type"
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={(v) => setTypeFilter(v as FinanceTransactionType)}
          />
        </div>
      </div>

      {tab === "yearly-summary" ? (
        <div className="mt-6 space-y-8">
          {loadingSummary ? (
            <p className="py-8 text-center text-sm text-[#666]">Loading summary…</p>
          ) : summary ? (
            <>
              {typeFilter !== "expense" && (
                <SummaryTable
                  title={`Income Summary (${yearLabel})`}
                  titleColor="text-[#27b85e]"
                  headerBorder="border-[#27b85e]"
                  footerBg="bg-[#e5f6eb]"
                  tone="income"
                  monthLabels={monthLabels}
                  rows={[
                    ...filteredIncomeRows,
                    {
                      label: "Total Income",
                      months: summary.income.totals,
                      total: summary.income.grandTotal,
                      isTotal: true,
                    },
                  ]}
                />
              )}

              {typeFilter !== "income" && (
                <SummaryTable
                  title={`Expense Summary (${yearLabel})`}
                  titleColor="text-red-500"
                  headerBorder="border-red-500"
                  footerBg="bg-[#fde9e9]"
                  tone="expense"
                  monthLabels={monthLabels}
                  rows={[
                    ...filteredExpenseRows,
                    {
                      label: "Total Expense",
                      months: summary.expense.totals,
                      total: summary.expense.grandTotal,
                      isTotal: true,
                    },
                  ]}
                />
              )}

              <SummaryTable
                title={`Net Balance (${yearLabel})`}
                titleColor="text-brand-primary"
                headerBorder="border-brand-primary"
                footerBg="bg-[rgba(0,118,233,0.08)]"
                tone="net"
                monthLabels={monthLabels}
                rows={[
                  {
                    label: summary.netBalance.label,
                    months: summary.netBalance.months,
                    total: summary.netBalance.total,
                    isTotal: true,
                  },
                ]}
              />
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 text-[13px] text-[#666]">
            Showing{" "}
            <span className="font-medium text-[#333]">
              {MONTH_OPTIONS.find((o) => Number(o.value) === txMonth)?.label} {viewYear}
            </span>
          </p>
          {/* Mobile / tablet cards */}
          <div className="space-y-3 lg:hidden">
            {loadingTx ? (
              <p className="py-10 text-center text-sm text-[#666]">Loading transactions…</p>
            ) : transactions.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#666]">No transactions found</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-lg border border-[#f2f2f2] bg-[#fafafa] p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-[#333]">{tx.title}</p>
                      {tx.description && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-[#666]">{tx.description}</p>
                      )}
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-[14px] font-semibold",
                        tx.type === "income" ? "text-[#27b85e]" : "text-red-500",
                      )}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatTk(tx.amount)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-[#666]">
                      {format(parseISO(tx.date), "dd-MM-yyyy")}
                    </span>
                    <span className="text-[#ccc]">·</span>
                    <span className="text-[12px] text-[#666]">{tx.category}</span>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold",
                        tx.type === "income"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700",
                      )}
                    >
                      {tx.type === "income" ? "Income" : "Expense"}
                    </span>
                    <div className="ml-auto">
                      {tx.source === "ledger" ? (
                        <button
                          type="button"
                          aria-label={`Delete ${tx.title}`}
                          onClick={() => handleDelete(tx)}
                          className="inline-flex size-8 items-center justify-center rounded text-[#999] hover:bg-[#fff1f2] hover:text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#999]">Invoice</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          <CursorPagination pageInfo={cursorTable.pageInfo} onCursorChange={cursorTable.onCursorChange} loading={cursorTable.loading} error={cursorTable.error} retry={cursorTable.refresh} /></div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <Table cursorPagination={cursorTable} className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[rgba(0,0,0,0.16)]">
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Date</th>
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Description</th>
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Category</th>
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Type</th>
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Amount</th>
                  <th className="px-3 py-2 text-[14px] font-medium text-[#333]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingTx ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-[#666]">
                      Loading transactions…
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-[#666]">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#f2f2f2] hover:bg-[#fafafa]">
                      <td className="whitespace-nowrap px-3 py-2.5 text-[14px] text-[rgba(0,0,0,0.6)]">
                        {format(parseISO(tx.date), "dd-MM-yyyy")}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <p className="truncate text-[14px] font-medium text-[#333]">{tx.title}</p>
                        {tx.description && (
                          <p className="truncate text-[12px] text-[#666]">{tx.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[14px] text-[#333]">{tx.category}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-semibold",
                            tx.type === "income"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700",
                          )}
                        >
                          {tx.type === "income" ? "Income" : "Expense"}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-2.5 text-[14px] font-medium",
                          tx.type === "income" ? "text-[#27b85e]" : "text-red-500",
                        )}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatTk(tx.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        {tx.source === "ledger" ? (
                          <button
                            type="button"
                            aria-label={`Delete ${tx.title}`}
                            onClick={() => handleDelete(tx)}
                            className="inline-flex size-7 items-center justify-center rounded text-[#999] hover:bg-[#fff1f2] hover:text-red-500"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : (
                          <span className="text-[12px] text-[#999]">Invoice</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {txTotal > 0 && (
            <></>
          )}
        </div>
      )}
    </div>
  )
}
