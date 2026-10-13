"use client"

import { useEffect, useMemo, useState } from "react"
import { Phone, Printer, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatCurrency, formatMoney } from "@/lib/utils"
import {
  resolveInvoiceTaxRate,
  resolveReceiptFinancials,
} from "@admin/lib/invoice-receipt-html"
import {
  deriveInvoiceStatus,
  type InvoiceStatusValue,
} from "./invoice-status-badge"
import { useBusiness } from "@/context/BusinessContext"

export interface InvoiceCatalogItem {
  name: string
  price: number
}

export interface InvoiceDetailsData {
  id: string
  invoiceNo: string
  client: string
  clientPhone: string
  services: string[]
  packageNames?: string[]
  amount: number
  paidAmount?: number
  paymentMethod: string
  staff: string
  /** Logged-in cashier who processed payment — Name (Role) */
  printBy?: string
  date: string
  status: InvoiceStatusValue
  source: "online" | "offline"
  /** Tax % frozen on the invoice / booking — never live settings. */
  taxRate?: number | null
  discount?: number
  /** Prior due collected on this invoice (POS Due Collection) */
  dueCollected?: number
  /** Customer's outstanding due when collection was added */
  priorDueSnapshot?: number | null
}

interface InvoiceDetailsModalProps {
  invoice: InvoiceDetailsData | null
  open: boolean
  saving?: boolean
  serviceCatalog?: InvoiceCatalogItem[]
  packageCatalog?: InvoiceCatalogItem[]
  onOpenChange: (open: boolean) => void
  onPrint?: (invoice: InvoiceDetailsData) => void
  onRecordPayment?: (invoice: InvoiceDetailsData, paymentAmount: number) => void | Promise<void>
}

interface LineItem {
  name: string
  qty: number
  unitPrice: number | null
  lineTotal: number | null
}

function statusStyles(status: InvoiceStatusValue) {
  switch (status) {
    case "Paid":
      return "bg-emerald-50 text-emerald-700"
    case "Partial":
      return "bg-amber-50 text-amber-700"
    case "Unpaid":
    default:
      return "bg-rose-50 text-rose-700"
  }
}

function splitNames(value?: string | string[] | null) {
  if (!value) return []
  const raw = Array.isArray(value) ? value : value.split(",")
  return raw.map((s) => s.trim()).filter(Boolean)
}

function groupCounts(names: string[]) {
  const map = new Map<string, number>()
  for (const name of names) {
    map.set(name, (map.get(name) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }))
}

function priceLookup(catalog: InvoiceCatalogItem[] | undefined, name: string) {
  if (!catalog?.length) return null
  const needle = name.trim().toLowerCase()
  const match = catalog.find((item) => item.name.trim().toLowerCase() === needle)
  if (!match) return null
  const price = Number(match.price)
  return Number.isFinite(price) ? price : null
}

function toLineItems(
  names: string[],
  catalog?: InvoiceCatalogItem[],
): LineItem[] {
  return groupCounts(names).map(({ name, qty }) => {
    const unitPrice = priceLookup(catalog, name)
    return {
      name,
      qty,
      unitPrice,
      lineTotal: unitPrice == null ? null : unitPrice * qty,
    }
  })
}

export function splitInvoiceItems(
  serviceNames: string[],
  packageNamesFromAppt: string[] | undefined,
  serviceCatalog?: InvoiceCatalogItem[],
  packageCatalog?: InvoiceCatalogItem[],
) {
  // Keep every occurrence — qty is encoded as repeated names (never collapse with Set)
  const storedPackages = splitNames(packageNamesFromAppt)
  const all = splitNames(serviceNames)
  const packageCatalogNames = new Set((packageCatalog ?? []).map((p) => p.name))
  const serviceCatalogNames = new Set((serviceCatalog ?? []).map((s) => s.name))

  if (storedPackages.length > 0) {
    const packageSet = new Set(storedPackages)
    const services = all.filter((name) => !packageSet.has(name))
    return { services, packages: storedPackages }
  }

  // Legacy invoices: packages were mixed into the services array
  const packages: string[] = []
  const services: string[] = []
  for (const name of all) {
    const isPackage =
      packageCatalogNames.has(name) && !serviceCatalogNames.has(name)
    if (isPackage) packages.push(name)
    else services.push(name)
  }

  return { services, packages }
}

function LineItemsBlock({
  title,
  items,
}: {
  title: string
  items: LineItem[]
}) {
  if (items.length === 0) return null

  const sectionTotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)
  const hasPrices = items.some((item) => item.lineTotal != null)
  const needsScroll = items.length > 5

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="mb-0 border-b border-[#e8e8e8] pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
          {title}
        </p>
        {hasPrices && (
          <p className="text-[11px] tabular-nums text-[#666]">{formatCurrency(sectionTotal)}</p>
        )}
      </div>
      <ul
        className={cn(
          "space-y-1.5 pr-1 text-[13px]",
          // Hard cap at ~5 rows so row 6+ requires scroll
          needsScroll && "max-h-[120px] overflow-y-scroll overscroll-contain",
        )}
      >
        {items.map((item) => (
          <li
            key={`${title}-${item.name}-${item.qty}`}
            className="flex items-baseline justify-between gap-2 text-[13px]"
          >
            <p className="min-w-0 truncate text-[#333]" title={item.name}>
              {item.name}{" "}
              <span className="font-medium text-brand-primary">×{item.qty}</span>
              {item.unitPrice != null && (
                <span className="ml-1 text-[11px] text-[#999]">
                  @ {formatCurrency(item.unitPrice)}
                </span>
              )}
            </p>
            <p className="shrink-0 tabular-nums text-[#333]">
              {item.lineTotal != null ? formatCurrency(item.lineTotal) : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function InvoiceDetailsModal({
  invoice,
  open,
  saving = false,
  serviceCatalog = [],
  packageCatalog = [],
  onOpenChange,
  onPrint,
  onRecordPayment,
}: InvoiceDetailsModalProps) {
  const { businessInfo } = useBusiness()
  const gstBinNumber = businessInfo?.gstNumber?.trim() || ""
  const businessAddress = businessInfo?.address?.trim() || ""
  const [paymentInput, setPaymentInput] = useState("")

  const alreadyPaid = Math.max(0, Number(invoice?.paidAmount) || 0)
  const total = Math.max(0, Number(invoice?.amount) || 0)
  const remainingDue = Math.max(0, total - alreadyPaid)
  const displayStatus = invoice
    ? deriveInvoiceStatus(invoice.amount, invoice.paidAmount)
    : "Unpaid"

  const { items, sectionTitle, financials } = useMemo(() => {
    if (!invoice) {
      return {
        items: [] as LineItem[],
        sectionTitle: "Items",
        financials: null as null | {
          subTotal: number
          discount: number
          vatAmount: number
          taxRate: number
          dueCollected: number
          priorDueSnapshot: number | null
        },
      }
    }
    const split = splitInvoiceItems(
      invoice.services,
      invoice.packageNames,
      serviceCatalog,
      packageCatalog,
    )
    const serviceLines = toLineItems(split.services, serviceCatalog)
    const packageLines = toLineItems(split.packages, packageCatalog)
    const hasServices = serviceLines.length > 0
    const hasPackages = packageLines.length > 0

    let sectionTitle = "Items"
    if (hasServices && hasPackages) sectionTitle = "Services & Packages"
    else if (hasServices) sectionTitle = "Services"
    else if (hasPackages) sectionTitle = "Packages"

    // Packages first, then services when both
    const items = [...packageLines, ...serviceLines]
    const catalogSubtotal = items.reduce((sum, row) => sum + (row.lineTotal ?? 0), 0)
    const discountAmount = Math.max(0, Number(invoice.discount) || 0)
    const dueCollected = Math.max(0, Number(invoice.dueCollected) || 0)
    const taxRate = resolveInvoiceTaxRate({
      snapshottedRate: invoice.taxRate,
      catalogSubtotal,
      totalAmount: Math.max(0, Number(invoice.amount) || 0) - dueCollected,
      discount: discountAmount,
    })
    const { subTotal, discount, vatAmount, taxRate: resolvedRate } =
      resolveReceiptFinancials({
        catalogSubtotal,
        totalAmount: Math.max(0, Number(invoice.amount) || 0),
        taxRate,
        discount: discountAmount,
        dueCollected,
      })

    return {
      items,
      sectionTitle,
      financials: {
        subTotal,
        discount,
        vatAmount,
        taxRate: resolvedRate,
        dueCollected,
        priorDueSnapshot:
          invoice.priorDueSnapshot != null
            ? Math.max(0, Number(invoice.priorDueSnapshot))
            : null,
      },
    }
  }, [invoice, serviceCatalog, packageCatalog])

  useEffect(() => {
    if (!open || !invoice) {
      setPaymentInput("")
      return
    }
    setPaymentInput("")
  }, [open, invoice?.id])

  const parsedPayment = useMemo(() => {
    if (paymentInput.trim() === "") return Number.NaN
    return Number.parseFloat(paymentInput)
  }, [paymentInput])

  const paymentError = useMemo(() => {
    if (paymentInput.trim() === "") return null
    if (!Number.isFinite(parsedPayment) || parsedPayment <= 0) {
      return "Enter an amount greater than 0"
    }
    if (parsedPayment > remainingDue + 1e-9) {
      return `Cannot exceed due (${formatCurrency(remainingDue)})`
    }
    return null
  }, [paymentInput, parsedPayment, remainingDue])

  const canSubmit =
    remainingDue > 0 &&
    paymentInput.trim() !== "" &&
    Number.isFinite(parsedPayment) &&
    parsedPayment > 0 &&
    parsedPayment <= remainingDue &&
    !paymentError

  const afterPaid = canSubmit ? alreadyPaid + parsedPayment : alreadyPaid
  const afterDue = Math.max(0, total - afterPaid)

  const clampPayment = (raw: string) => {
    if (raw === "") {
      setPaymentInput("")
      return
    }
    const next = raw.replace(/[^\d.]/g, "")
    const parts = next.split(".")
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : next
    const value = Number.parseFloat(normalized)
    if (Number.isFinite(value) && value > remainingDue) {
      setPaymentInput(String(remainingDue))
      return
    }
    setPaymentInput(normalized)
  }

  const fillFull = () => {
    if (remainingDue <= 0) return
    setPaymentInput(
      Number.isInteger(remainingDue)
        ? String(remainingDue)
        : remainingDue.toFixed(2),
    )
  }

  const handleSubmit = async () => {
    if (!invoice || !canSubmit || !onRecordPayment) return
    await onRecordPayment(invoice, parsedPayment)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-lg sm:max-w-[520px]"
      >
        {invoice && (
          <div className="bg-white">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-semibold text-[#111]">
                  {invoice.invoiceNo}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[12px] text-[#888]">
                  {invoice.client}
                  {invoice.clientPhone ? ` · ${invoice.clientPhone}` : ""}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                    statusStyles(displayStatus),
                  )}
                >
                  {displayStatus}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex size-7 items-center justify-center rounded-md text-[#888] hover:bg-brand-mist hover:text-[#333]"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {(businessAddress || gstBinNumber) && (
              <div className="space-y-1 border-b border-[#e8e8e8] px-5 pb-3 text-[11px] leading-relaxed text-[#666]">
                {businessAddress && <p>{businessAddress}</p>}
                {gstBinNumber && (
                  <p>
                    <span className="text-[#888]">BIN No:</span>{" "}
                    <span className="font-medium text-[#333]">{gstBinNumber}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-5 px-5 pb-5">
              <div className="grid grid-cols-3 gap-x-4 text-[13px]">
                <div>
                  <p className="text-[11px] text-[#888]">Total</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-[#111]">
                    {formatCurrency(total)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#888]">Received</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(alreadyPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#888]">Due</p>
                  <p
                    className={cn(
                      "mt-0.5 font-semibold tabular-nums",
                      remainingDue > 0 ? "text-rose-600" : "text-[#111]",
                    )}
                  >
                    {formatCurrency(remainingDue)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-x-4 text-[12px] text-[#555]">
                <div>
                  <span className="text-[#888]">Date </span>
                  {invoice.date || "—"}
                </div>
                <div className="truncate">
                  <span className="text-[#888]">Artist </span>
                  {invoice.staff || "—"}
                </div>
                <div>
                  <span className="text-[#888]">Pay </span>
                  {invoice.paymentMethod || "—"}
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-[13px] text-[#999]">
                  {financials && financials.dueCollected > 0
                    ? "Due collection only (no services/packages)"
                    : "No items"}
                </p>
              ) : (
                <LineItemsBlock title={sectionTitle} items={items} />
              )}

              {financials &&
                (financials.subTotal > 0 ||
                  financials.vatAmount > 0 ||
                  financials.dueCollected > 0) && (
                <div className="space-y-1.5 border-t border-[#e8e8e8] pt-3 text-[13px]">
                  {financials.subTotal > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#888]">Subtotal</span>
                      <span className="tabular-nums text-[#333]">
                        {formatCurrency(financials.subTotal)}
                      </span>
                    </div>
                  )}
                  {financials.discount > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#888]">Discount</span>
                      <span className="tabular-nums text-[#333]">
                        −{formatCurrency(financials.discount)}
                      </span>
                    </div>
                  )}
                  {(financials.vatAmount > 0 || financials.taxRate > 0) && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#888]">
                        VAT
                        {financials.taxRate > 0
                          ? ` (${formatMoney(financials.taxRate)}%)`
                          : ""}
                      </span>
                      <span className="tabular-nums text-[#333]">
                        {formatCurrency(financials.vatAmount)}
                      </span>
                    </div>
                  )}
                  {financials.dueCollected > 0 && (
                    <>
                      {financials.priorDueSnapshot != null &&
                        financials.priorDueSnapshot > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#888]">Previous outstanding</span>
                            <span className="tabular-nums text-[#333]">
                              {formatCurrency(financials.priorDueSnapshot)}
                            </span>
                          </div>
                        )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#888]">Due Collection</span>
                        <span className="tabular-nums text-[#333]">
                          {formatCurrency(financials.dueCollected)}
                        </span>
                      </div>
                      {financials.priorDueSnapshot != null && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#888]">Remaining prior due</span>
                          <span className="tabular-nums text-[#333]">
                            {formatCurrency(
                              Math.max(
                                0,
                                financials.priorDueSnapshot - financials.dueCollected,
                              ),
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-0.5 font-semibold text-[#111]">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(total)}</span>
                  </div>
                </div>
              )}

              {remainingDue > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[#333]">
                      Collect payment
                      <span className="ml-1 font-normal text-[#888]">
                        (max {formatCurrency(remainingDue)})
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={fillFull}
                      className="text-[12px] font-semibold text-brand-primary hover:underline"
                    >
                      Full
                    </button>
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[#999]">
                      ৳
                    </span>
                    <Input
                      id="invoice-payment-amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={remainingDue}
                      step="0.01"
                      value={paymentInput}
                      onChange={(e) => clampPayment(e.target.value)}
                      placeholder={formatMoney(remainingDue)}
                      className={cn(
                        "h-9 rounded-lg border-[#e5e5e5] bg-white pl-7 text-[13px] tabular-nums shadow-none focus-visible:border-brand-primary focus-visible:ring-brand-primary/15",
                        paymentError && "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-[#888]">
                    {paymentError ? (
                      <span className="text-destructive">{paymentError}</span>
                    ) : canSubmit ? (
                      <>
                        After: paid {formatCurrency(afterPaid)}
                        {afterDue > 0
                          ? ` · due ${formatCurrency(afterDue)}`
                          : " · will be Paid"}
                      </>
                    ) : (
                      "Enter this installment amount"
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] font-medium text-emerald-700">Fully paid</p>
              )}
            </div>

            <div className="flex items-center gap-2 px-5 pb-5">
              <Button
                type="button"
                variant="ghost"
                className="h-9 flex-1 text-[#555] hover:bg-brand-mist"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 flex-1 text-[#555] hover:bg-brand-mist"
                onClick={() => onPrint?.(invoice)}
               accessAction="export">
                <Printer className="mr-1 size-3.5" />
                Print
              </Button>
              {remainingDue > 0 && (
                <Button
                  type="button"
                  className="h-9 flex-[1.2] bg-brand-primary text-white hover:bg-brand-hover disabled:opacity-50"
                  disabled={!canSubmit || saving}
                  onClick={handleSubmit}
                >
                  {saving ? "Saving..." : "Record"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
