"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Wallet } from "lucide-react"
import { getClientHistory } from "@admin/api/clients/clients"
import { updateInvoice } from "@admin/api/billing/billing"
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
  AdminPageHeader,
  AdminHeaderPrimaryButton,
  AdminHeaderSecondaryButton,
} from "@admin/components/admin-page-header"
import {
  deriveInvoiceStatus,
  InvoiceStatusBadge,
  type InvoiceStatusValue,
} from "@admin/components/invoice/invoice-status-badge"
import { cn, formatCurrency } from "@/lib/utils"

interface DueInvoiceRow {
  id: string
  invoiceNo: string
  date: string
  staff: string
  total: number
  paidAmount: number
  due: number
  status: InvoiceStatusValue
}

function resolveBackendStatus(
  amount: number,
  paidAmount: number,
): "Paid" | "Due" | "Partial" {
  const display = deriveInvoiceStatus(amount, paidAmount)
  if (display === "Unpaid") return "Due"
  return display
}

function sanitizeMoney(raw: string) {
  return raw.replace(/[^\d.]/g, "")
}

export default function ClientDuePaymentPage() {
  const params = useParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentAmount = Math.max(0, Number(searchParams.get("amount")) || 0)

  const [clientName, setClientName] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rows, setRows] = useState<DueInvoiceRow[]>([])
  /** invoiceId → amount to apply from this payment */
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getClientHistory(id, true)
      setClientName(String(data?.name || "Client"))
      const nextRows: DueInvoiceRow[] = (data?.invoices ?? [])
        .map((inv: any) => {
          const total = Math.max(0, Number(inv.total) || 0)
          const paidAmount =
            inv.paidAmount != null ? Math.max(0, Number(inv.paidAmount) || 0) : 0
          const due = Math.max(0, total - paidAmount)
          const status = deriveInvoiceStatus(total, paidAmount)
          return {
            id: String(inv.id),
            invoiceNo: String(inv.invoiceNumber || inv.id),
            date: String(inv.confirmedAt ?? inv.createdAt ?? "").split("T")[0] || "—",
            staff: String(inv.staff || "—"),
            total,
            paidAmount,
            due,
            status,
          }
        })
        .filter((row: DueInvoiceRow) => row.due > 0.009)
        .sort((a: DueInvoiceRow, b: DueInvoiceRow) => {
          const rank = (s: InvoiceStatusValue) =>
            s === "Unpaid" ? 0 : s === "Partial" ? 1 : 2
          const d = rank(a.status) - rank(b.status)
          if (d !== 0) return d
          return (a.date || "").localeCompare(b.date || "")
        })
      setRows(nextRows)
      setAllocations({})
    } catch (err) {
      console.error(err)
      toast.error("Failed to load client invoices")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const allocatedTotal = useMemo(() => {
    return rows.reduce((sum, row) => {
      const n = Number(allocations[row.id] || 0)
      return sum + (Number.isFinite(n) ? Math.max(0, n) : 0)
    }, 0)
  }, [rows, allocations])

  const remainingPool = Math.max(0, paymentAmount - allocatedTotal)
  const totalDue = useMemo(
    () => rows.reduce((sum, row) => sum + row.due, 0),
    [rows],
  )

  const setAllocation = (invoiceId: string, raw: string, maxDue: number) => {
    const cleaned = sanitizeMoney(raw)
    if (cleaned === "" || cleaned === ".") {
      setAllocations((prev) => ({ ...prev, [invoiceId]: cleaned }))
      return
    }
    const value = Number(cleaned)
    if (!Number.isFinite(value)) return
    setAllocations((prev) => {
      const others = rows.reduce((sum, r) => {
        if (r.id === invoiceId) return sum
        const n = Number(prev[r.id] || 0)
        return sum + (Number.isFinite(n) ? Math.max(0, n) : 0)
      }, 0)
      const maxFromPool = Math.max(0, paymentAmount - others)
      const capped = Math.min(Math.max(0, value), maxDue, maxFromPool)
      return {
        ...prev,
        [invoiceId]: Number.isInteger(capped) ? String(capped) : capped.toFixed(2),
      }
    })
  }

  const fillFull = (row: DueInvoiceRow) => {
    const others = rows.reduce((sum, r) => {
      if (r.id === row.id) return sum
      const n = Number(allocations[r.id] || 0)
      return sum + (Number.isFinite(n) ? Math.max(0, n) : 0)
    }, 0)
    const available = Math.max(0, paymentAmount - others)
    const apply = Math.min(row.due, available)
    setAllocations((prev) => ({
      ...prev,
      [row.id]: Number.isInteger(apply) ? String(apply) : apply.toFixed(2),
    }))
  }

  const clearAll = () => setAllocations({})

  const handleSubmit = async () => {
    if (!(paymentAmount > 0)) {
      toast.error("Missing payment amount — go back and enter it again")
      return
    }
    if (allocatedTotal <= 0) {
      toast.error("Allocate payment to at least one invoice")
      return
    }
    if (allocatedTotal > paymentAmount + 0.009) {
      toast.error(
        `Allocated ${formatCurrency(allocatedTotal)} exceeds received ${formatCurrency(paymentAmount)}`,
      )
      return
    }

    const updates = rows
      .map((row) => {
        const apply = Math.max(0, Number(allocations[row.id] || 0) || 0)
        if (!(apply > 0)) return null
        if (apply > row.due + 0.009) return null
        const paidAmount = Math.min(row.total, row.paidAmount + apply)
        const nextStatus = resolveBackendStatus(row.total, paidAmount)
        return {
          row,
          apply,
          paidAmount,
          nextStatus,
        }
      })
      .filter(Boolean) as {
      row: DueInvoiceRow
      apply: number
      paidAmount: number
      nextStatus: "Paid" | "Due" | "Partial"
    }[]

    if (updates.length === 0) {
      toast.error("Allocate payment to at least one invoice")
      return
    }

    setSubmitting(true)
    try {
      for (const item of updates) {
        await updateInvoice(item.row.id, {
          paidAmount: item.paidAmount,
          status: item.nextStatus,
          applyCommission:
            item.nextStatus === "Paid" &&
            !!item.row.staff &&
            item.row.staff !== "—" &&
            item.row.staff !== "?" &&
            item.row.staff !== "N/A",
        })
      }
      const leftover = Math.max(0, paymentAmount - allocatedTotal)
      toast.success(
        leftover > 0.009
          ? `Applied ${formatCurrency(allocatedTotal)} · ${formatCurrency(leftover)} not allocated`
          : `Applied ${formatCurrency(allocatedTotal)} across ${updates.length} invoice${updates.length === 1 ? "" : "s"}`,
      )
      if (id) router.push(`/admin/clients/${encodeURIComponent(id)}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Failed to apply due payment")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!id) {
    return (
      <div className="premium-page p-8 text-center text-muted-foreground">
        Invalid client.
      </div>
    )
  }

  if (!(paymentAmount > 0)) {
    return (
      <div className="premium-page p-4 sm:p-6 md:p-8">
        <AdminPageHeader
          title="Allocate Due Payment"
          subtitle="Payment amount is missing"
          actions={
            <AdminHeaderSecondaryButton
              onClick={() => router.push(`/admin/clients/${encodeURIComponent(id)}`)}
            >
              <ArrowLeft />
              Back to Client
            </AdminHeaderSecondaryButton>
          }
        />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Go back to the client page and use <strong>Add Due Payment</strong> again.
        </div>
      </div>
    )
  }

  return (
    <div className="premium-page p-4 sm:p-6 md:p-8">
      <AdminPageHeader
        title="Allocate Due Payment"
        subtitle={
          clientName
            ? `Distribute ${formatCurrency(paymentAmount)} across unpaid invoices for ${clientName}`
            : `Distribute ${formatCurrency(paymentAmount)} across unpaid invoices`
        }
        actions={
          <>
            <AdminHeaderSecondaryButton
              onClick={() => router.push(`/admin/clients/${encodeURIComponent(id)}`)}
              disabled={submitting}
            >
              <ArrowLeft />
              Cancel
            </AdminHeaderSecondaryButton>
            <AdminHeaderPrimaryButton onClick={() => void handleSubmit()} disabled={submitting}>
              <Wallet />
              {submitting ? "Applying…" : "Apply Payment"}
            </AdminHeaderPrimaryButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#cfe3ff] bg-[#f5faff] px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-primary/80">
            Amount received
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-primary">
            {formatCurrency(paymentAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Allocated
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              allocatedTotal > paymentAmount + 0.009 ? "text-rose-600" : "text-foreground",
            )}
          >
            {formatCurrency(allocatedTotal)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Remaining to allocate
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(remainingPool)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h3 className="font-medium text-foreground">Unpaid &amp; Partial invoices</h3>
            <p className="text-sm text-muted-foreground">
              {rows.length} invoice{rows.length === 1 ? "" : "s"} · total due{" "}
              {formatCurrency(totalDue)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={submitting}>
            Clear allocations
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading invoices…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">
            No unpaid or partially paid invoices for this client.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[180px]">Allocate</TableHead>
                  <TableHead>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const apply = Math.max(0, Number(allocations[row.id] || 0) || 0)
                  const afterPaid = Math.min(row.total, row.paidAmount + apply)
                  const afterDue = Math.max(0, row.total - afterPaid)
                  const afterStatus = deriveInvoiceStatus(row.total, afterPaid)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {row.invoiceNo}
                      </TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.staff}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="tabular-nums text-emerald-700">
                        {formatCurrency(row.paidAmount)}
                      </TableCell>
                      <TableCell className="tabular-nums font-medium text-rose-600">
                        {formatCurrency(row.due)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            className="h-9 w-[110px] tabular-nums"
                            placeholder="e.g. 1500"
                            value={allocations[row.id] ?? ""}
                            disabled={submitting}
                            onChange={(e) => setAllocation(row.id, e.target.value, row.due)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0"
                            disabled={submitting}
                            onClick={() => fillFull(row)}
                          >
                            Full
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <InvoiceStatusBadge value={afterStatus} />
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            due {formatCurrency(afterDue)}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
