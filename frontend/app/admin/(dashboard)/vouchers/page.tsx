"use client"
import { ModernSelect } from "@/components/ui/modern-select";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Download, Plus } from "lucide-react"
import { toast } from "@/lib/toast"
import { resolveBusinessName } from "@/lib/business-branding"
import { useBusiness } from "@/context/BusinessContext"
import {
  AdminPageHeader,
  AdminHeaderPrimaryButton,
  AdminHeaderSecondaryButton,
} from "@admin/components/admin-page-header"
import { VoucherKpiCards } from "@admin/components/voucher-kpi-cards"
import { DashPage } from "@admin/components/dash"
import { VoucherList } from "@admin/components/voucher-list"
import { VoucherDetailsModal } from "@admin/components/voucher-details-modal"
import {
  type Voucher,
  type VoucherDateRange,
  computeVoucherKpis,
  formatVoucherAmount,
  formatVoucherDisplayDate,
  getDateRangeBounds,
  voucherInRange,
} from "@admin/lib/vouchers"
import {
  buildVoucherReceiptHtml,
  formatReceiptDateTime,
  receiptBrandFromBusinessName,
  receiptCompanyFromBusinessName,
} from "@admin/lib/voucher-receipt-html"
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceEntries,
  type FinanceEntry,
} from "@admin/api/finance/finance"
import {
  getActiveFinanceCategories,
  PAYROLL_OWNED_CATEGORY_CODES,
  type FinanceCategory,
} from "@admin/api/finance/finance-categories"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function financeEntryToVoucher(entry: FinanceEntry): Voucher {
  const year = String(entry.date).slice(0, 4) || new Date().getFullYear().toString()
  // Derived from the entry's own stable id — never from its position in a fetched page.
  // An index-based sequence would reassign a different voucher number to the same entry
  // (or the same number to a different entry) whenever the list is re-sorted, re-paginated,
  // or another voucher is added/deleted — corrupting any already-printed receipt's number.
  const seq = (entry.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "000000"
  return {
    id: entry.id,
    voucherNo: `V-${year}-${seq}`,
    date: String(entry.date).slice(0, 10),
    title: entry.title,
    description: entry.description?.trim() || entry.title,
    type: entry.type === "income" ? "Income" : "Expense",
    amount: Number(entry.amount) || 0,
  }
}

function openPrintDocument(title: string, html: string, size = "width=420,height=900") {
  // Do not use "noopener" in features — it makes window.open return null in many browsers
  const win = window.open("", "_blank", size)
  if (!win) {
    toast.error("Pop-up blocked. Allow pop-ups to continue.")
    return false
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    try {
      win.print()
    } catch {
      /* ignore */
    }
  }, 400)
  return true
}

function exportVouchersPdf(vouchers: Voucher[], range: VoucherDateRange) {
  const rows = vouchers
    .map(
      (v) => `<tr>
      <td>${escapeHtml(v.voucherNo)}</td>
      <td>${escapeHtml(formatVoucherDisplayDate(v.date))}</td>
      <td>${escapeHtml(v.title)}</td>
      <td>${escapeHtml(v.description)}</td>
      <td>${escapeHtml(v.type)}</td>
      <td>${escapeHtml(formatVoucherAmount(v.type, v.amount))}</td>
    </tr>`,
    )
    .join("")

  const ok = openPrintDocument(
    `Vouchers — ${range}`,
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Vouchers — ${escapeHtml(range)}</title>
    <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; color: #333; padding: 24px; }
    h1 { color: #7040c1; font-size: 22px; margin: 0 0 4px; }
    .meta { color: #666; margin-bottom: 20px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e8e8e8; }
    th { background: #fafafa; font-weight: 600; }
  </style></head><body>
  <h1>Voucher List</h1>
  <p class="meta">Period: ${escapeHtml(range)} · ${vouchers.length} entries · Print / Save as PDF from the browser dialog</p>
  <table>
    <thead>
      <tr>
        <th>Voucher No</th><th>Date</th><th>Title</th>
        <th>Description</th><th>Type</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6">No vouchers in this period.</td></tr>`}</tbody>
  </table>
</body></html>`,
    "width=900,height=720",
  )
  if (ok) toast.success("Export ready — use Print → Save as PDF")
}

export default function VouchersPage() {
  const { businessName, businessInfo } = useBusiness()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<VoucherDateRange>("This Month")
  const [showNewForm, setShowNewForm] = useState(false)
  const [viewVoucher, setViewVoucher] = useState<Voucher | null>(null)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    type: "Expense" as Voucher["type"],
    category: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  })

  const printVoucher = useCallback(
    (voucher: Voucher) => {
      const bName = resolveBusinessName(businessName)
      const brand = receiptBrandFromBusinessName(bName)
      const company = receiptCompanyFromBusinessName(businessInfo?.businessName || bName)
      const html = buildVoucherReceiptHtml({
        brandName: brand,
        companyName: company,
        address: businessInfo?.address || undefined,
        vatRegNo: businessInfo?.gstNumber || undefined,
        voucherNo: voucher.voucherNo,
        dateTimeLabel: formatReceiptDateTime(voucher.date),
        title: voucher.title,
        description: voucher.description,
        type: voucher.type,
        amount: voucher.amount,
        supportPhone: businessInfo?.phone || undefined,
      })
      openPrintDocument(voucher.voucherNo, html)
    },
    [businessName, businessInfo],
  )

  const loadVouchers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFinanceEntries(1, 200, true)
      const rows = (res?.data ?? []) as FinanceEntry[]
      setVouchers(rows.map((entry) => financeEntryToVoucher(entry)))
    } catch (err) {
      console.error(err)
      toast.error("Failed to load vouchers")
      setVouchers([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async (voucherType: Voucher["type"]) => {
    try {
      const apiType = voucherType === "Income" ? "income" : "expense"
      const all = await getActiveFinanceCategories(apiType, true)
      // Payroll-owned categories are written only by Manage Payroll — the server rejects
      // manual entries filed under them, so don't offer them here.
      const rows = all.filter((c) => !PAYROLL_OWNED_CATEGORY_CODES.includes(c.code ?? ""))
      setCategories(rows)
      setDraft((d) => {
        if (rows.some((c) => c.name === d.category)) return d
        return { ...d, category: rows[0]?.name ?? "" }
      })
    } catch (err) {
      console.error(err)
      setCategories([])
    }
  }, [])

  useEffect(() => {
    void loadVouchers()
  }, [loadVouchers])

  useEffect(() => {
    if (showNewForm) void loadCategories(draft.type)
  }, [showNewForm, draft.type, loadCategories])

  const stats = useMemo(
    () => computeVoucherKpis(vouchers, dateRange),
    [vouchers, dateRange],
  )

  const exportRows = useMemo(() => {
    const { from, to } = getDateRangeBounds(dateRange)
    return vouchers.filter((v) => voucherInRange(v.date, from, to))
  }, [vouchers, dateRange])

  const handleDelete = async (id: string) => {
    const target = vouchers.find((v) => v.id === id)
    if (!target) return
    if (!window.confirm(`Delete voucher ${target.voucherNo}? This cannot be undone.`)) return
    try {
      await deleteFinanceEntry(id)
      setVouchers((prev) => prev.filter((v) => v.id !== id))
      toast.success(`${target.voucherNo} deleted`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete voucher")
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
    if (!draft.category.trim()) {
      toast.error("Select a category")
      return
    }

    setSaving(true)
    try {
      await createFinanceEntry({
        type: draft.type === "Income" ? "income" : "expense",
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        category: draft.category.trim(),
        amount,
        date: draft.date,
      })
      setShowNewForm(false)
      setDraft({
        title: "",
        description: "",
        type: "Expense",
        category: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
      })
      toast.success("Voucher created")
      await loadVouchers()
    } catch (err) {
      console.error(err)
      toast.error("Failed to create voucher")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashPage className="p-3 sm:p-6 md:p-8">
      <AdminPageHeader
        title="Voucher"
        subtitle="Create and manage vouchers for income and expense payments"
        actions={
          <>
            <AdminHeaderSecondaryButton
              onClick={() => exportVouchersPdf(exportRows, dateRange)}
              className="flex-1 sm:flex-none"
             accessAction="export">
              <Download />
              Export PDF
            </AdminHeaderSecondaryButton>
            <AdminHeaderPrimaryButton
              onClick={() => setShowNewForm(true)}
              className="flex-1 sm:flex-none"
             accessAction="create">
              <Plus />
              New Voucher
            </AdminHeaderPrimaryButton>
          </>
        }
      />

      <div className="space-y-5">
        {loading ? (
          <div className="rounded-lg border border-[#f2f2f2] bg-white px-5 py-10 text-center text-sm text-[#666]">
            Loading vouchers…
          </div>
        ) : (
          <>
            <VoucherKpiCards stats={stats} />
            <VoucherList
              vouchers={vouchers}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onDelete={handleDelete}
              onPrint={printVoucher}
              onView={setViewVoucher}
            />
          </>
        )}
      </div>

      <VoucherDetailsModal
        voucher={viewVoucher}
        open={!!viewVoucher}
        onOpenChange={(open) => {
          if (!open) setViewVoucher(null)
        }}
        onPrint={(v) => {
          printVoucher(v)
        }}
      />

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowNewForm(false)}
          />
          <form
            onSubmit={handleCreate}
            aria-labelledby="new-voucher-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#e8e8e8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:rounded-xl"
          >
            <h2 id="new-voucher-title" className="text-lg font-semibold text-[#333]">
              New Voucher
            </h2>
            <p className="mt-1 text-sm text-[#666]">Add an income or expense voucher.</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#444]">
                Title
                <input placeholder="e.g. Monthly salon supplies"
                  required
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#444]">
                Description
                <input placeholder="e.g. Monthly supplies for the main branch."
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#444]">
                  Type
                  <ModernSelect
                    value={draft.type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        type: e.target.value as Voucher["type"],
                        category: "",
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </ModernSelect>
                </label>
                <label className="block text-sm font-medium text-[#444]">
                  Category
                  <ModernSelect
                    required
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  >
                    <option value="" disabled>
                      {categories.length ? "Select category" : "No active categories"}
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </ModernSelect>
                </label>
              </div>
              <label className="block text-sm font-medium text-[#444]">
                Amount (Tk.)
                <input placeholder="e.g. 1500"
                  required
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#444]">
                Date
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="h-10 rounded-md px-4 text-sm font-medium text-[#555] hover:bg-brand-mist"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashPage>
  )
}
