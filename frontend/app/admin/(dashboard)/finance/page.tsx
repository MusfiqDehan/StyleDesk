"use client"
import { ModernSelect } from "@/components/ui/modern-select";

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Download, Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import {
  AdminPageHeader,
  AdminHeaderPrimaryButton,
  AdminHeaderSecondaryButton,
  AdminHeaderYearSwitch,
} from "@admin/components/admin-page-header"
import { IncomeExpenseTrendChart } from "@admin/components/finance/income-expense-trend-chart"
import { FinanceLedgerPanel } from "@admin/components/finance/finance-ledger-panel"
import { FinanceKpiCards } from "@admin/components/finance/finance-kpi-cards"
import { DashboardSection, OverviewPage } from "@admin/components/dash"
import {
  getDashboardChart,
  mapFinancePoints,
  type FinanceChartPoint,
} from "@admin/api/dashboard/charts"
import {
  createFinanceEntry,
  getFinanceOverview,
  type FinanceOverview,
} from "@admin/api/finance/finance"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatTk(value: number) {
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`
}

function exportTrendPdf(points: FinanceChartPoint[], rangeLabel: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=720")
  if (!win) {
    toast.error("Pop-up blocked. Allow pop-ups to export PDF.")
    return
  }

  const rows = points
    .map(
      (p) => `<tr>
      <td>${escapeHtml(p.label)}</td>
      <td>${escapeHtml(formatTk(p.income))}</td>
      <td>${escapeHtml(formatTk(p.expense))}</td>
      <td>${escapeHtml(formatTk(p.paid))}</td>
      <td>${escapeHtml(formatTk(p.due))}</td>
      <td>${escapeHtml(formatTk(p.income - p.expense))}</td>
    </tr>`,
    )
    .join("")

  win.document.open()
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Income vs Expense — ${escapeHtml(rangeLabel)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #333; padding: 24px; }
  h1 { color: #0076e9; font-size: 22px; margin: 0 0 4px; }
  .meta { color: #666; margin-bottom: 20px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e8e8e8; }
  th { background: #fafafa; font-weight: 600; }
</style></head><body>
  <h1>Income vs Expense Trend</h1>
  <p class="meta">Period: ${escapeHtml(rangeLabel)} · Print / Save as PDF from the browser dialog</p>
  <table>
    <thead><tr><th>Period</th><th>Income</th><th>Expense</th><th>Paid</th><th>Due</th><th>Net</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">No data</td></tr>`}</tbody>
  </table>
  <script>window.onload = function () { window.print(); }</script>
</body></html>`)
  win.document.close()
  toast.success("Export ready — use Print → Save as PDF")
}

export default function FinancePage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [ledgerRefresh, setLedgerRefresh] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    type: "expense" as "income" | "expense",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  })

  const loadOverview = useCallback(async (selectedYear: number) => {
    setOverviewLoading(true)
    try {
      const data = await getFinanceOverview(selectedYear, true)
      setOverview(data)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load finance overview")
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview(year)
  }, [year, loadOverview])

  const handleExportTrend = async () => {
    try {
      const response = await getDashboardChart<FinanceChartPoint>("finance", "year", true)
      const chartPoints = mapFinancePoints(response.points)
      exportTrendPdf(chartPoints, `Year view (${year})`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to export finance trend")
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(draft.amount)
    if (!draft.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setSaving(true)
    try {
      await createFinanceEntry({
        type: draft.type,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        amount,
        date: draft.date,
      })
      toast.success("Entry added")
      setShowAdd(false)
      setDraft({
        title: "",
        description: "",
        type: "expense",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
      })
      await loadOverview(year)
      setLedgerRefresh((k) => k + 1)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add entry")
    } finally {
      setSaving(false)
    }
  }

  return (
    <OverviewPage>
      <AdminPageHeader
        eyebrow="Finance"
        title="Income & Expense"
        subtitle="Manage and track your salon income and expense transactions"
        actions={
          <>
            <AdminHeaderYearSwitch
              year={year}
              maxYear={currentYear}
              onYearChange={setYear}
            />
            <AdminHeaderSecondaryButton
              type="button"
              onClick={() => void handleExportTrend()}
              className="flex-1 sm:flex-none"
             accessAction="export">
              <Download />
              <span className="sm:inline">Export PDF</span>
            </AdminHeaderSecondaryButton>
            <AdminHeaderPrimaryButton
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex-1 sm:flex-none"
             accessAction="create">
              <Plus />
              Add Entry
            </AdminHeaderPrimaryButton>
          </>
        }
      />

      <DashboardSection title="Summary" description="Year-to-date income, expense, and balances">
        <FinanceKpiCards data={overview} loading={overviewLoading} />
      </DashboardSection>

      <DashboardSection title="Trends" description="Interactive income vs expense chart — range toggles fetch live data">
        <IncomeExpenseTrendChart />
      </DashboardSection>

      <DashboardSection title="Ledger" description="Detailed transaction history">
        <FinanceLedgerPanel
          year={year}
          refreshKey={ledgerRefresh}
          onChanged={() => {
            void loadOverview(year)
          }}
        />
      </DashboardSection>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setShowAdd(false)}
          />
          <form
            onSubmit={handleCreate}
            aria-labelledby="add-finance-entry-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#e8e8e8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:rounded-xl"
          >
            <h2
              id="add-finance-entry-title"
              className="text-lg font-semibold text-[#333]"
            >
              Add Entry
            </h2>
            <p className="mt-1 text-sm text-[#666]">
              Record an income or expense transaction.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#444]">
                Title
                <input placeholder="e.g. Monthly salon supplies"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#444]">
                Description
                <input placeholder="e.g. Monthly supplies for the main branch."
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[#444]">
                  Type
                  <ModernSelect
                    value={draft.type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        type: e.target.value as "income" | "expense",
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </ModernSelect>
                </label>
                <label className="block text-sm font-medium text-[#444]">
                  Amount (Tk.)
                  <input placeholder="e.g. 1500"
                    required
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, amount: e.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  />
                </label>
              </div>
              {draft.type === "income" && (
                <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  Sales from Bookings/POS invoices are tracked automatically — don&apos;t
                  re-enter them here, or they&apos;ll be double-counted in the totals.
                </p>
              )}
              <label className="block text-sm font-medium text-[#444]">
                Date
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, date: e.target.value }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowAdd(false)}
                className="h-10 rounded-md px-4 text-sm font-medium text-[#555] hover:bg-brand-mist"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </OverviewPage>
  )
}
