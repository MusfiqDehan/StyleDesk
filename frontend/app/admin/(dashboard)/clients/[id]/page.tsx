"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { getClientHistory } from "@admin/api/clients/clients"
import { deleteInvoice, updateInvoice } from "@admin/api/billing/billing"
import { getActiveServices } from "@admin/api/services/services"
import { getPackages } from "@admin/api/packages/packages"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Phone, Mail, Receipt, Printer, Trash2, Wallet, User } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { resolveBusinessName } from "@/lib/business-branding"
import { useBusiness } from "@/context/BusinessContext"
import { useAuth } from "@admin/hooks/use-auth"
import { getPosOrderTakerDisplay } from "@admin/components/pos/pos-utils"
import {
  AdminPageHeader,
  AdminHeaderSecondaryButton,
  AdminHeaderPrimaryButton,
} from "@admin/components/admin-page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InvoiceDetailsModal,
  type InvoiceDetailsData,
} from "@admin/components/invoice/invoice-details-modal"
import {
  deriveInvoiceStatus,
  InvoiceStatusBadge,
  type InvoiceStatusValue,
} from "@admin/components/invoice/invoice-status-badge"
import {
  buildInvoiceReceiptHtml,
  formatReceiptDateTime,
  lookupCatalogUnitPrice,
  receiptBrandFromBusinessName,
  receiptCompanyFromBusinessName,
  resolveInvoiceTaxRate,
  resolveReceiptFinancials,
} from "@admin/lib/invoice-receipt-html"

interface Invoice {
  id: string
  invoiceNumber: string
  services: string[]
  packageNames?: string[] | null
  staff: string
  printBy?: string | null
  total: number
  paidAmount?: number | null
  paymentMethod: string
  status: string
  createdAt: string
  confirmedAt?: string | null
  source?: string
}

interface ClientHistory {
  id: string
  name: string
  phone: string
  email: string
  address: string
  appointments?: { id: string }[]
  invoices: Invoice[]
}

function statusRank(status: InvoiceStatusValue) {
  if (status === "Unpaid") return 0
  if (status === "Partial") return 1
  return 2 // Paid last
}

/** Backend payment status (Due = unpaid). */
function resolveBackendInvoiceStatus(
  amount: number,
  paidAmount?: number | null,
): "Paid" | "Due" | "Partial" {
  const display = deriveInvoiceStatus(amount, paidAmount)
  if (display === "Unpaid") return "Due"
  return display
}

function splitPackageNames(value?: string | string[] | null) {
  if (!value) return [] as string[]
  if (Array.isArray(value)) return value.map((s) => String(s || "").trim()).filter(Boolean)
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function toDetailsInvoice(
  inv: Invoice & {
    appointment?: {
      id?: string | null
      packageName?: string | null
      services?: string[] | null
      taxRate?: number | null
      discount?: number | null
    }
    taxRate?: number | null
  },
  client: ClientHistory,
  packageCatalogNames?: Set<string>,
): InvoiceDetailsData {
  const amount = Math.max(0, Number(inv.total) || 0)
  const paidAmount =
    inv.paidAmount != null ? Math.max(0, Number(inv.paidAmount) || 0) : undefined
  const sortAt = inv.confirmedAt ?? inv.createdAt ?? ""
  const hasAppointment = Boolean(
    (inv as { appointmentId?: string }).appointmentId || inv.appointment?.id,
  )
  const sourceRaw = (inv.source || "").toString().toLowerCase()
  const source: "online" | "offline" = hasAppointment
    ? "online"
    : sourceRaw.includes("online")
      ? "online"
      : "offline"

  const rawServices = Array.isArray(inv.services)
    ? inv.services.map((s) => String(s || "").trim()).filter(Boolean)
    : []
  // Booking source of truth — preserves qty (repeated names). Never collapse with Set.
  const fromApptPackages = splitPackageNames(inv.appointment?.packageName)
  const fromStoredPackages = splitPackageNames(inv.packageNames)
  const apptServices = Array.isArray(inv.appointment?.services)
    ? inv.appointment.services.map((s) => String(s || "").trim()).filter(Boolean)
    : []
  const detectedFromServices = packageCatalogNames?.size
    ? rawServices.filter((name) => packageCatalogNames.has(name))
    : []

  const packageNames =
    fromApptPackages.length > 0
      ? fromApptPackages
      : fromStoredPackages.length > 0
        ? fromStoredPackages
        : detectedFromServices

  const packageNameSet = new Set(packageNames)
  const invoiceOnlyServices = rawServices.filter((name) => !packageNameSet.has(name))
  const apptOnlyServices = apptServices.filter((name) => !packageNameSet.has(name))
  const services =
    apptOnlyServices.length > invoiceOnlyServices.length
      ? apptOnlyServices
      : invoiceOnlyServices.length > 0
        ? invoiceOnlyServices
        : apptOnlyServices
  // Prefer invoice snapshot, then booking snapshot — never live settings
  const taxRate =
    inv.taxRate != null && Number.isFinite(Number(inv.taxRate))
      ? Number(inv.taxRate)
      : inv.appointment?.taxRate != null && Number.isFinite(Number(inv.appointment.taxRate))
        ? Number(inv.appointment.taxRate)
        : null
  // Prefer invoice's own snapshot (POS), then the linked booking's discount
  const discount =
    (inv as { discount?: number | null }).discount != null &&
    Number.isFinite(Number((inv as { discount?: number | null }).discount))
      ? Math.max(0, Number((inv as { discount?: number | null }).discount) || 0)
      : inv.appointment?.discount != null
        ? Math.max(0, Number(inv.appointment.discount) || 0)
        : 0

  const dueCollected =
    (inv as { dueCollected?: number | null }).dueCollected != null &&
    Number.isFinite(Number((inv as { dueCollected?: number | null }).dueCollected))
      ? Math.max(0, Number((inv as { dueCollected?: number | null }).dueCollected) || 0)
      : 0
  const priorDueSnapshot =
    (inv as { priorDueSnapshot?: number | null }).priorDueSnapshot != null &&
    Number.isFinite(Number((inv as { priorDueSnapshot?: number | null }).priorDueSnapshot))
      ? Math.max(0, Number((inv as { priorDueSnapshot?: number | null }).priorDueSnapshot) || 0)
      : null

  return {
    id: inv.id,
    invoiceNo: inv.invoiceNumber,
    client: client.name,
    clientPhone: client.phone,
    services,
    packageNames: packageNames.length ? packageNames : undefined,
    amount,
    paidAmount,
    paymentMethod: inv.paymentMethod || "Cash",
    staff: inv.staff || "—",
    printBy: inv.printBy?.trim() || undefined,
    date: sortAt ? String(sortAt).split("T")[0] : "",
    status: deriveInvoiceStatus(amount, paidAmount),
    source,
    taxRate,
    discount,
    dueCollected,
    priorDueSnapshot,
  }
}

export default function ClientHistoryPage() {
  const params = useParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const { user } = useAuth()
  const cashierLabel = getPosOrderTakerDisplay(user)
  const { businessName, businessInfo } = useBusiness()
  const [client, setClient] = useState<ClientHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetailsData | null>(null)
  const [viewIsSaving, setViewIsSaving] = useState(false)
  const [deleteInvoiceState, setDeleteInvoiceState] = useState<InvoiceDetailsData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [duePaymentOpen, setDuePaymentOpen] = useState(false)
  const [duePaymentAmount, setDuePaymentAmount] = useState("")
  const [duePaymentError, setDuePaymentError] = useState("")
  const [serviceCatalog, setServiceCatalog] = useState<{ name: string; price: number }[]>([])
  const [packageCatalog, setPackageCatalog] = useState<{ name: string; price: number }[]>([])

  const reloadClient = useCallback(async () => {
    if (!id) return
    const data = await getClientHistory(id, true)
    setClient(data)
  }, [id])

  useEffect(() => {
    if (!id) return

    setLoading(true)
    getClientHistory(id, true)
      .then(setClient)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    getActiveServices(true)
      .then((data: any) => {
        const list = data?.data ?? data
        setServiceCatalog(
          Array.isArray(list)
            ? list
                .map((s: any) => ({
                  name: String(s.name || "").trim(),
                  price: Number(s.price) || 0,
                }))
                .filter((s: { name: string }) => s.name)
            : [],
        )
      })
      .catch(() => {})

    // Packages use `title` (same as /admin/invoices) — not `name`
    getPackages(true)
      .then((data: any) => {
        const list = data?.data ?? data
        setPackageCatalog(
          Array.isArray(list)
            ? list
                .map((p: any) => ({
                  name: String(p.title ?? p.name ?? "").trim(),
                  price: Number(p.price) || 0,
                }))
                .filter((p: { name: string }) => Boolean(p.name))
            : [],
        )
      })
      .catch(() => {})
  }, [])

  const invoices = useMemo(() => {
    if (!client) return [] as InvoiceDetailsData[]
    const packageCatalogNames = new Set(packageCatalog.map((p) => p.name))
    return [...(client.invoices ?? [])]
      .map((inv) => toDetailsInvoice(inv, client, packageCatalogNames))
      .sort((a, b) => {
        const rankDiff = statusRank(a.status) - statusRank(b.status)
        if (rankDiff !== 0) return rankDiff
        return (b.date || "").localeCompare(a.date || "")
      })
  }, [client, packageCatalog])

  const handleRecordPayment = async (
    invoice: InvoiceDetailsData,
    paymentAmount: number,
  ) => {
    const alreadyPaid = Math.max(0, Number(invoice.paidAmount) || 0)
    const total = Math.max(0, Number(invoice.amount) || 0)
    const remainingDue = Math.max(0, total - alreadyPaid)
    const installment = Math.min(Math.max(0, paymentAmount), remainingDue)

    if (!(installment > 0)) {
      toast.error("Enter a payment greater than 0")
      return
    }

    const paidAmount = Math.min(total, alreadyPaid + installment)
    const nextStatus = resolveBackendInvoiceStatus(total, paidAmount)

    setViewIsSaving(true)
    try {
      await updateInvoice(invoice.id, {
        status: nextStatus,
        paidAmount,
        ...(nextStatus === "Paid" && !invoice.printBy
          ? { printBy: cashierLabel }
          : {}),
        applyCommission:
          nextStatus === "Paid" &&
          !!invoice.staff &&
          invoice.staff !== "?" &&
          invoice.staff !== "—" &&
          invoice.staff !== "N/A",
      })
      toast.success(
        nextStatus === "Paid"
          ? "Payment recorded — invoice is fully paid"
          : `Payment of ${formatCurrency(installment)} recorded`,
      )
      setViewInvoice(null)
      setClient((prev) => {
        if (!prev) return prev
        const backendStatus = nextStatus === "Due" ? "Due" : nextStatus
        return {
          ...prev,
          invoices: (prev.invoices ?? []).map((inv) =>
            inv.id === invoice.id
              ? {
                  ...inv,
                  paidAmount,
                  status: backendStatus,
                  ...(nextStatus === "Paid" && !invoice.printBy
                    ? { printBy: cashierLabel }
                    : {}),
                }
              : inv,
          ),
        }
      })
      await reloadClient()
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Failed to record payment")
      console.error(err)
    } finally {
      setViewIsSaving(false)
    }
  }

  const handlePrintInvoice = (invoice: InvoiceDetailsData) => {
    const netPayable = Math.max(0, Number(invoice.amount) || 0)
    const bName = resolveBusinessName(businessName)
    const brand = receiptBrandFromBusinessName(bName)
    const company = receiptCompanyFromBusinessName(businessInfo?.businessName || bName)
    const bAddress = businessInfo?.address || ""
    const bPhone = businessInfo?.phone || ""
    const bGst = businessInfo?.gstNumber || ""

    const priceMap = new Map<string, number>()
    for (const s of serviceCatalog) priceMap.set(s.name, s.price)
    for (const p of packageCatalog) {
      if (p.name) priceMap.set(p.name, p.price)
    }

    const counts: Record<string, number> = {}
    for (const svc of [...invoice.services, ...(invoice.packageNames ?? [])]) {
      if (!svc) continue
      counts[svc] = (counts[svc] ?? 0) + 1
    }

    const lineItems = Object.entries(counts).map(([name, qty]) => {
      const unitPrice = lookupCatalogUnitPrice(priceMap, name)
      return {
        name,
        unitPrice,
        qty,
        total: unitPrice * qty,
      }
    })

    const catalogSubtotal = lineItems.reduce((sum, row) => sum + row.total, 0)
    const discountAmount = Math.max(0, Number(invoice.discount) || 0)
    const dueCollected = Math.max(0, Number(invoice.dueCollected) || 0)
    const taxRate = resolveInvoiceTaxRate({
      snapshottedRate: invoice.taxRate,
      catalogSubtotal,
      totalAmount: Math.max(0, netPayable - dueCollected),
      discount: discountAmount,
    })
    const { subTotal, discount, vatAmount, taxRate: receiptTaxRate, totalAmount } =
      resolveReceiptFinancials({
        catalogSubtotal,
        totalAmount: netPayable,
        taxRate,
        discount: discountAmount,
        dueCollected,
      })
    const cashReceived = Math.max(0, Number(invoice.paidAmount) || 0)
    const paymentStatus =
      cashReceived <= 0
        ? ("Unpaid" as const)
        : cashReceived + 0.001 >= totalAmount
          ? ("Paid" as const)
          : ("Partial" as const)

    const html = buildInvoiceReceiptHtml({
      brandName: brand,
      companyName: company,
      address: bAddress || undefined,
      vatRegNo: bGst || undefined,
      cashier:
        (invoice.printBy && invoice.printBy !== "—")
          ? invoice.printBy
          : cashierLabel || undefined,
      terminalId: invoice.source === "online" ? "WEB" : "ADMIN",
      invoiceNo: invoice.invoiceNo,
      dateTimeLabel: formatReceiptDateTime(invoice.date),
      lineItems,
      subTotal,
      discount,
      taxRate: receiptTaxRate,
      vatAmount,
      totalAmount,
      dueCollected,
      cashReceived,
      paymentStatus,
      supportPhone: bPhone || undefined,
    })

    const win = window.open("", "_blank", "width=420,height=900")
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to print.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceState) return
    setDeleting(true)
    try {
      await deleteInvoice(deleteInvoiceState.id)
      toast.success(`Invoice ${deleteInvoiceState.invoiceNo} deleted`)
      setDeleteInvoiceState(null)
      if (viewInvoice?.id === deleteInvoiceState.id) setViewInvoice(null)
      await reloadClient()
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Failed to delete invoice")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className={`${DASH_PAGE} animate-pulse`}>
        <div className="h-6 w-32 bg-muted rounded mb-6" />
        <div className="h-28 bg-muted rounded-xl mb-6" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className={`${DASH_PAGE} text-center text-muted-foreground`}>
        Client not found.
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    )
  }

  const totalInvoices = invoices.length
  const unpaidTotal = invoices
    .filter((inv) => inv.status === "Unpaid")
    .reduce((sum, inv) => {
      const total = Math.max(0, Number(inv.amount) || 0)
      const paid = Math.max(0, Number(inv.paidAmount) || 0)
      return sum + Math.max(0, total - paid)
    }, 0)
  const partialTotal = invoices
    .filter((inv) => inv.status === "Partial")
    .reduce((sum, inv) => {
      const total = Math.max(0, Number(inv.amount) || 0)
      const paid = Math.max(0, Number(inv.paidAmount) || 0)
      return sum + Math.max(0, total - paid)
    }, 0)
  const totalOutstandingDue = unpaidTotal + partialTotal

  const openDuePaymentModal = () => {
    setDuePaymentError("")
    setDuePaymentAmount("")
    setDuePaymentOpen(true)
  }

  const continueDuePayment = () => {
    const raw = duePaymentAmount.trim().replace(/,/g, "")
    let amount = Number(raw)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDuePaymentError("Enter an amount greater than 0")
      return
    }
    // Clamp to outstanding due if somehow still over
    if (amount > totalOutstandingDue) {
      amount = totalOutstandingDue
      setDuePaymentAmount(
        Number.isInteger(totalOutstandingDue)
          ? String(totalOutstandingDue)
          : totalOutstandingDue.toFixed(2),
      )
    }
    if (!(amount > 0)) {
      setDuePaymentError("Enter an amount greater than 0")
      return
    }
    if (!id) return
    setDuePaymentOpen(false)
    router.push(
      `/admin/clients/${encodeURIComponent(id)}/due-payment?amount=${encodeURIComponent(String(amount))}`,
    )
  }

  const duePaymentEntered = (() => {
    const n = Number(duePaymentAmount.trim().replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : 0
  })()
  const duePaymentRemaining = Math.max(0, totalOutstandingDue - duePaymentEntered)

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        eyebrow="Client profile"
        breadcrumbs={[
          { label: "Clients", href: "/admin/clients" },
          { label: client.name },
        ]}
        title="Client History"
        subtitle="View and update invoices for this client"
        actions={
          <>
            {totalOutstandingDue > 0 && (
              <AdminHeaderPrimaryButton onClick={openDuePaymentModal} accessAction="create">
                <Wallet />
                Add Due Payment
              </AdminHeaderPrimaryButton>
            )}
            <AdminHeaderSecondaryButton onClick={() => router.back()}>
              <ArrowLeft />
              Back to Clients
            </AdminHeaderSecondaryButton>
          </>
        }
      />

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="size-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">{client.phone}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />{client.email}
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />{client.phone}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary/60" />
            <span>
              <span className="font-medium">{totalInvoices}</span> total invoice
              {totalInvoices === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700/80">
              Unpaid total
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatCurrency(unpaidTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700/80">
              Partial due total
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatCurrency(partialTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-[#cfe3ff] bg-[#f5faff] px-4 py-3 text-sm text-[#0b3b73]">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-primary/80">
              Total outstanding
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatCurrency(totalOutstandingDue)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Invoices</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unpaid → Partial → Paid — click a row to collect payment
            {invoices.length > 0 ? ` · ${invoices.length} total` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Services / Packages</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[96px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const total = Math.max(0, Number(inv.amount) || 0)
                  const paid = Math.max(0, Number(inv.paidAmount) || 0)
                  const due = Math.max(0, total - paid)
                  const services = [
                    ...(inv.packageNames ?? []),
                    ...inv.services.filter((s) => !(inv.packageNames ?? []).includes(s)),
                  ]

                  return (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setViewInvoice(inv)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {inv.invoiceNo}
                      </TableCell>
                      <TableCell>{inv.date || "—"}</TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate text-sm" title={services.join(", ")}>
                          {services.length > 0 ? services.join(", ") : "—"}
                        </div>
                      </TableCell>
                      <TableCell>{inv.staff || "—"}</TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {formatCurrency(total)}
                      </TableCell>
                      <TableCell className="tabular-nums text-emerald-700">
                        {formatCurrency(paid)}
                      </TableCell>
                      <TableCell
                        className={`tabular-nums font-medium ${due > 0 ? "text-rose-600" : "text-muted-foreground"}`}
                      >
                        {formatCurrency(due)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge value={inv.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg bg-[#f3f0ff] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
                            aria-label="Print invoice"
                            onClick={() => handlePrintInvoice(inv)}
                          >
                            <Printer className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg bg-[#fff1f2] text-[#e11d48] hover:bg-[#e11d48] hover:text-white"
                            aria-label="Delete invoice"
                            onClick={() => setDeleteInvoiceState(inv)}
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
      </div>

      <InvoiceDetailsModal
        invoice={viewInvoice}
        open={!!viewInvoice}
        saving={viewIsSaving}
        serviceCatalog={serviceCatalog}
        packageCatalog={packageCatalog}
        onOpenChange={(open) => {
          if (!open) setViewInvoice(null)
        }}
        onPrint={handlePrintInvoice}
        onRecordPayment={handleRecordPayment}
      />

      <Dialog
        open={!!deleteInvoiceState}
        onOpenChange={(open) => {
          if (!open) setDeleteInvoiceState(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete invoice{" "}
            <strong>{deleteInvoiceState?.invoiceNo}</strong>?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteInvoiceState(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteInvoice()}
              disabled={deleting}
             accessAction="delete">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={duePaymentOpen}
        onOpenChange={(open) => {
          setDuePaymentOpen(open)
          if (!open) {
            setDuePaymentError("")
            setDuePaymentAmount("")
          }
        }}
      >
        <DialogContent
          className="min-h-[340px] overflow-visible sm:max-w-[420px]"
          data-scroll-inside="true"
        >
          <DialogHeader>
            <DialogTitle>Add Due Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Enter the amount received from{" "}
              <span className="font-medium text-foreground">{client.name}</span>. You will
              allocate it across unpaid invoices on the next screen.
            </p>
            <div className="rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total outstanding due</span>
                <span className="font-semibold tabular-nums text-rose-600">
                  {formatCurrency(totalOutstandingDue)}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-payment-amount">Amount received</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="due-payment-amount"
                  inputMode="decimal"
                  placeholder="e.g. 150000"
                  className="flex-1"
                  value={duePaymentAmount}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d.]/g, "")
                    setDuePaymentError("")
                    if (cleaned === "" || cleaned === ".") {
                      setDuePaymentAmount(cleaned)
                      return
                    }
                    const value = Number(cleaned)
                    if (!Number.isFinite(value)) {
                      setDuePaymentAmount(cleaned)
                      return
                    }
                    if (value > totalOutstandingDue) {
                      setDuePaymentAmount(
                        Number.isInteger(totalOutstandingDue)
                          ? String(totalOutstandingDue)
                          : totalOutstandingDue.toFixed(2),
                      )
                      return
                    }
                    setDuePaymentAmount(cleaned)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      continueDuePayment()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 px-3"
                  onClick={() => {
                    setDuePaymentError("")
                    setDuePaymentAmount(
                      Number.isInteger(totalOutstandingDue)
                        ? String(totalOutstandingDue)
                        : totalOutstandingDue.toFixed(2),
                    )
                  }}
                >
                  Full
                </Button>
              </div>
              {duePaymentError ? (
                <p className="text-xs text-rose-600">{duePaymentError}</p>
              ) : duePaymentEntered > 0 && duePaymentRemaining > 0.009 ? (
                <p className="text-xs font-medium tabular-nums text-amber-700">
                  Remaining due after this payment: {formatCurrency(duePaymentRemaining)}
                </p>
              ) : duePaymentEntered > 0 && duePaymentRemaining <= 0.009 ? (
                <p className="text-xs font-medium text-emerald-700">
                  Full outstanding due will be covered
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Max {formatCurrency(totalOutstandingDue)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuePaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={continueDuePayment}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
