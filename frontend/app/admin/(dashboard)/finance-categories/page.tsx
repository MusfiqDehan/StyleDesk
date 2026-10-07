"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { ModernSelect } from "@/components/ui/modern-select";
import { CursorPagination } from "@/components/pagination/cursor-pagination"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "@/lib/toast"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import {
  AdminPageHeader,
  AdminHeaderPrimaryButton,
} from "@admin/components/admin-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  HEAD_CLASS,
  CELL_CLASS,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  FILTER_TRIGGER,
} from "@admin/lib/table-styles"
import {
  createFinanceCategory,
  deleteFinanceCategory,
  getFinanceCategories,
  updateFinanceCategory,
  type FinanceCategory,
  type FinanceCategoryStatus,
  type FinanceCategoryType,
} from "@admin/api/finance/finance-categories"

const PAGE_SIZE = 10

type Draft = {
  name: string
  type: FinanceCategoryType
  status: FinanceCategoryStatus
}

const emptyDraft: Draft = {
  name: "",
  type: "expense",
  status: "active",
}

export default function FinanceCategoriesPage() {
  const [rows, setRows] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const [typeFilter, setTypeFilter] = useState<FinanceCategoryType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<FinanceCategoryStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  const cursorTable = useRemoteCursor<FinanceCategory>('/finance/categories', {
    search: debouncedSearch, type: typeFilter, status: statusFilter,
  })
  const load = async () => cursorTable.refresh()
  useEffect(() => {
    setRows(cursorTable.data); setLoading(cursorTable.loading)
    setTotal(cursorTable.pageInfo.total); setPage(cursorTable.pageInfo.page)
  }, [cursorTable.data, cursorTable.loading, cursorTable.pageInfo])

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setDialogOpen(true)
  }

  const openEdit = (row: FinanceCategory) => {
    setEditing(row)
    setDraft({
      name: row.name,
      type: row.type,
      status: row.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error("Category name is required")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateFinanceCategory(editing.id, {
          name: draft.name.trim(),
          type: draft.type,
          status: draft.status,
        })
        toast.success("Category updated")
      } else {
        await createFinanceCategory({
          name: draft.name.trim(),
          type: draft.type,
          status: draft.status,
        })
        toast.success("Category created")
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      console.error(err)
      const msg =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(", ")
          : null) ||
        "Failed to save category"
      toast.error(typeof msg === "string" ? msg : "Failed to save category")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: FinanceCategory) => {
    if (!window.confirm(`Delete category "${row.name}"? This cannot be undone.`)) return
    try {
      await deleteFinanceCategory(row.id)
      toast.success("Category deleted")
      await load()
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete category")
    }
  }

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        title="Custom Categories"
        subtitle="Manage your custom income and expense categories for Finance and Vouchers. System categories (like Service/Package Revenue) are bound automatically and are not listed here."
        actions={
          <AdminHeaderPrimaryButton onClick={openCreate} className="w-full sm:w-auto" accessAction="create">
            <Plus />
            Add Category
          </AdminHeaderPrimaryButton>
        }
      />

      <div className={cn(TABLE_CARD_CLASS)}>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          <div className="relative w-full min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className={cn(SEARCH_INPUT_CLASS, "pl-9")}
            />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <ModernSelect
              aria-label="Filter category type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FinanceCategoryType | "all")}
              className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 sm:w-[150px] sm:flex-none")}
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </ModernSelect>
            <ModernSelect
              aria-label="Filter category status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as FinanceCategoryStatus | "all")
              }
              className={cn(FILTER_TRIGGER, "w-full min-w-0 flex-1 sm:w-[150px] sm:flex-none")}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </ModernSelect>
          </div>
          <span className="text-sm text-[#666] sm:ml-auto">{total} results</span>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-3 sm:hidden">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No categories found</p>
          ) : (
            rows.map((row, index) => (
              <div key={row.id} className="rounded-lg border border-[#f2f2f2] bg-[#fafafa] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#999]">
                      #{cursorTable.pageInfo.from + index}
                    </p>
                    <p className="mt-0.5 text-[15px] font-medium text-[#333]">{row.name}</p>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-[#666] hover:bg-[#f0f7ff] hover:text-brand-primary"
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-[#666] hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      row.type === "income"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700",
                    )}
                  >
                    {row.type === "income" ? "Income" : "Expense"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      row.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-[#e7e7e7] bg-[#f8fafc] text-[#555]",
                    )}
                  >
                    {row.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))
          )}
        <CursorPagination pageInfo={cursorTable.pageInfo} onCursorChange={cursorTable.onCursorChange} loading={cursorTable.loading} error={cursorTable.error} retry={cursorTable.refresh} /></div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <Table cursorPagination={cursorTable}>
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={HEAD_CLASS}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Category Name</TableHead>
                <TableHead className={HEAD_CLASS}>Type</TableHead>
                <TableHead className={HEAD_CLASS}>Status</TableHead>
                <TableHead className={cn(HEAD_CLASS, "text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-10 text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-10 text-sm text-muted-foreground">
                    No categories found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
                  <TableRow key={row.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "font-medium")}>{row.name}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          row.type === "income"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {row.type === "income" ? "Income" : "Expense"}
                      </span>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          row.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-[#e7e7e7] bg-[#f8fafc] text-[#555]",
                        )}
                      >
                        {row.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "text-right")}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-[#666] hover:bg-[#f0f7ff] hover:text-brand-primary"
                          title="Edit"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-[#666] hover:bg-rose-50 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
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

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDialogOpen(false)}
          />
          <form
            onSubmit={handleSave}
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#e8e8e8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:rounded-xl"
          >
            <h2 className="text-lg font-semibold text-[#333]">
              {editing ? "Edit Category" : "Add Category"}
            </h2>
            <p className="mt-1 text-sm text-[#666]">
              Categories appear in Finance summaries and voucher creation.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#444]">
                Category Name
                <input placeholder="e.g. Salon supplies"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#444]">
                  Type
                  <ModernSelect
                    value={draft.type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        type: e.target.value as FinanceCategoryType,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </ModernSelect>
                </label>
                <label className="block text-sm font-medium text-[#444]">
                  Status
                  <ModernSelect
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as FinanceCategoryStatus,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-[#e8e8e8] bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </ModernSelect>
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="h-10 rounded-md px-4 text-sm font-medium text-[#555] hover:bg-brand-mist"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
