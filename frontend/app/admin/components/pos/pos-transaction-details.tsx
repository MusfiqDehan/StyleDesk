"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
import { createClient } from "@admin/api/clients/clients"
import { createInvoice } from "@admin/api/billing/billing"
import { markInvoiceUnread } from "@admin/lib/invoice-unread"
import { refreshPosCollectionSummary } from "./pos-collection-summary"
import { getBasicEmployees } from "@admin/api/employees/employees"
import { getInvoiceSettings } from "@admin/api/settings/settings"
import { cn } from "@/lib/utils"
import { resolveBusinessName } from "@/lib/business-branding"
import { useBusiness } from "@/context/BusinessContext"
import {
  buildInvoiceReceiptHtml,
  formatReceiptDateTime,
  receiptBrandFromBusinessName,
  receiptCompanyFromBusinessName,
  resolveReceiptFinancials,
} from "@admin/lib/invoice-receipt-html"
import type { PosCartItem } from "./pos-selected-services-panel"
import { PosTransactionActions } from "./pos-transaction-actions"
import { PosCustomerDetails } from "./pos-customer-details"
import { PosPaymentSummary } from "./pos-payment-summary"
import { PosSelectPayment, type PosPaymentMethod } from "./pos-select-payment"
import { PosCashPaymentModal } from "./pos-cash-payment-modal"
import { PosOnlinePaymentModal, type PosOnlineMethod } from "./pos-online-payment-modal"
import { PosTaxModal, type PosTaxApplyMode } from "./pos-tax-modal"
import {
  PosDiscountModal,
  type PosDiscountType,
} from "./pos-discount-modal"
import type { PosCustomer, PosVisitType } from "./pos-utils"
import { getPosOrderTakerDisplay, isValidBangladeshiPhone, normalizePosPhone } from "./pos-utils"
import { useAuth } from "@admin/hooks/use-auth"
import {
  addHeldTransaction,
  loadHeldTransactions,
  removeHeldTransaction,
  clearAllHeldTransactions,
  type PosHeldTransaction,
} from "@admin/lib/pos-hold-storage"
import { PosHeldTransactionsDialog } from "./pos-held-transactions-dialog"

interface PosTransactionDetailsProps {
  items: PosCartItem[]
  onResetCart: () => void
  onRestoreCart: (items: PosCartItem[]) => void
  className?: string
}

function expandCartByType(items: PosCartItem[]) {
  const services: string[] = []
  const packageNames: string[] = []
  for (const item of items) {
    const target = item.type === "package" ? packageNames : services
    for (let i = 0; i < item.quantity; i++) {
      target.push(item.name)
    }
  }
  return { services, packageNames }
}

export function PosTransactionDetails({
  items,
  onResetCart,
  onRestoreCart,
  className,
}: PosTransactionDetailsProps) {
  const { businessName, businessInfo } = useBusiness()
  const { user } = useAuth()
  const orderTakenBy = getPosOrderTakerDisplay(user)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [visitType, setVisitType] = useState<PosVisitType>("walk-in")
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)
  const [discountType, setDiscountType] = useState<PosDiscountType>("percentage")
  const [discountValue, setDiscountValue] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash")
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [onlineModalOpen, setOnlineModalOpen] = useState(false)
  const [taxModalOpen, setTaxModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCustomerErrors, setNewCustomerErrors] = useState<{ name?: string; phone?: string }>({})
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [employeeNames, setEmployeeNames] = useState<string[]>([])
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [heldTransactions, setHeldTransactions] = useState(() => loadHeldTransactions())
  const [holdsOpen, setHoldsOpen] = useState(false)
  const [pendingRecall, setPendingRecall] = useState<PosHeldTransaction | null>(null)

  const refreshHeldTransactions = () => {
    setHeldTransactions(loadHeldTransactions())
  }

  useEffect(() => {
    refreshHeldTransactions()
  }, [])

  useEffect(() => {
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate != null && !Number.isNaN(Number(settings.taxRate))) {
          const rate = Number(settings.taxRate)
          setDefaultTaxRate(rate)
          setTaxRate(rate)
        }
      })
      .catch(() => {
        // keep default
      })
  }, [])

  useEffect(() => {
    getBasicEmployees(true)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        const names = list
          .map((e: any) => String(e.name || "").trim())
          .filter(Boolean)
        setEmployeeNames([...new Set(names)] as string[])
      })
      .catch(() => setEmployeeNames([]))
  }, [])

  useEffect(() => {
    if (customer?.discountPercent != null) {
      setDiscountType("percentage")
      setDiscountValue(customer.discountPercent)
    }
  }, [customer])

  const subTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )

  const discountAmount =
    discountType === "flat"
      ? Math.min(subTotal, Math.round(discountValue || 0))
      : Math.round((subTotal * (discountValue || 0)) / 100)
  const taxableBase = Math.max(0, subTotal - discountAmount)
  // Ceil (not round) to match booking-confirm and receipt VAT rounding everywhere else
  const taxAmount = Math.ceil((taxableBase * taxRate) / 100)
  const totalPayable = taxableBase + taxAmount

  const handleTaxSubmit = (payload: {
    taxRate: number
    applyMode: PosTaxApplyMode
  }) => {
    // Transaction-only — Settings → Billing remains the global default
    void payload.applyMode
    setTaxRate(payload.taxRate)
    toast.success("VAT applied to this transaction")
  }

  const handleTaxRemove = () => {
    setTaxRate(0)
    toast.success("VAT removed from this transaction")
  }

  const handleDiscountSubmit = (payload: {
    type: PosDiscountType
    value: number
  }) => {
    setDiscountType(payload.type)
    setDiscountValue(payload.value)
    toast.success("Discount applied")
  }

  const handleDiscountRemove = () => {
    setDiscountType("percentage")
    setDiscountValue(0)
    toast.success("Discount removed")
  }

  const resetSale = (opts?: { keepInvoiceNo?: boolean }) => {
    setCustomer(null)
    setDiscountType("percentage")
    setDiscountValue(0)
    setPaymentMethod("cash")
    setVisitType("walk-in")
    setTaxRate(defaultTaxRate)
    onResetCart()
    if (!opts?.keepInvoiceNo) {
      setInvoiceNo("")
    }
  }

  const handleReset = () => {
    resetSale()
  }

  const handleNew = () => {
    resetSale()
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate != null && !Number.isNaN(Number(settings.taxRate))) {
          const rate = Number(settings.taxRate)
          setDefaultTaxRate(rate)
          setTaxRate(rate)
        }
      })
      .catch(() => {
        setTaxRate(defaultTaxRate)
      })
  }

  const snapshotCurrentSale = () => ({
    items: items.map((item) => ({ ...item })),
    customer,
    visitType,
    taxRate,
    discountType,
    discountValue,
    paymentMethod,
  })

  const handleHold = () => {
    if (items.length === 0) {
      if (heldTransactions.length > 0) {
        setHoldsOpen(true)
      } else {
        toast.error("Add services before holding a transaction")
      }
      return
    }

    addHeldTransaction(snapshotCurrentSale())
    refreshHeldTransactions()
    resetSale()
    toast.success("Transaction held — tap Hold again to recall")
  }

  const handleViewHolds = () => {
    if (heldTransactions.length === 0) {
      toast.message("No held transactions")
      return
    }
    setHoldsOpen(true)
  }

  const applyRecallHold = (hold: PosHeldTransaction) => {
    onRestoreCart(hold.items.map((item) => ({ ...item })))
    setCustomer(hold.customer)
    setVisitType(hold.visitType)
    setTaxRate(hold.taxRate)
    setDiscountType(hold.discountType)
    setDiscountValue(hold.discountValue)
    setPaymentMethod(hold.paymentMethod)
    setInvoiceNo("")
    removeHeldTransaction(hold.id)
    refreshHeldTransactions()
    setHoldsOpen(false)
    toast.success("Held transaction restored")
  }

  const handleRecallHold = (hold: PosHeldTransaction) => {
    if (items.length > 0) {
      setPendingRecall(hold)
      return
    }
    applyRecallHold(hold)
  }

  const confirmRecallWithAutoHold = () => {
    if (!pendingRecall) return
    if (items.length > 0) {
      addHeldTransaction(snapshotCurrentSale())
      refreshHeldTransactions()
    }
    applyRecallHold(pendingRecall)
    setPendingRecall(null)
  }

  const handleDeleteHold = (id: string) => {
    removeHeldTransaction(id)
    refreshHeldTransactions()
    toast.success("Held transaction removed")
  }

  const handleRemoveAllHolds = () => {
    if (heldTransactions.length === 0) return
    clearAllHeldTransactions()
    refreshHeldTransactions()
    setHoldsOpen(false)
    toast.success("All held transactions removed")
  }

  const validateNewCustomer = () => {
    const errors: { name?: string; phone?: string } = {}
    if (!newName.trim()) {
      errors.name = "Name is required"
    }
    if (!newPhone.trim()) {
      errors.phone = "Phone number is required"
    } else if (!isValidBangladeshiPhone(newPhone)) {
      errors.phone = "Please enter a valid Bangladeshi phone number (e.g. 01712345678)"
    }
    return errors
  }

  const openAddCustomer = () => {
    setNewName("")
    setNewPhone("")
    setNewCustomerErrors({})
    setAddOpen(true)
  }

  const handleCreateCustomer = async () => {
    const errors = validateNewCustomer()
    setNewCustomerErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavingCustomer(true)
    try {
      const res: any = await createClient({
        name: newName.trim(),
        phone: normalizePosPhone(newPhone.trim()),
      })
      const created = res?.data ?? res
      setCustomer({
        id: created.id,
        name: created.name,
        phone: created.phone,
        points: 0,
        discountPercent: 0,
      })
      setAddOpen(false)
      setNewName("")
      setNewPhone("")
      setNewCustomerErrors({})
      toast.success("Customer added")
    } catch (err: any) {
      console.error(err)
      const msg = err?.response?.data?.message
      const finalMsg = Array.isArray(msg) ? msg.join(", ") : msg || "Failed to add customer"
      if (typeof finalMsg === "string" && /phone/i.test(finalMsg)) {
        setNewCustomerErrors((prev) => ({ ...prev, phone: finalMsg }))
      } else {
        toast.error(finalMsg)
      }
    } finally {
      setSavingCustomer(false)
    }
  }

  const openPaymentModal = (method: PosPaymentMethod) => {
    if (items.length === 0) {
      toast.error("Select a service or package before payment")
      return
    }
    if (!customer?.id || !customer.name?.trim() || !customer.phone?.trim()) {
      toast.error("Select or add a customer before payment")
      return
    }
    if (totalPayable < 0) {
      toast.error("Total payable cannot be negative")
      return
    }
    if (method === "cash") setCashModalOpen(true)
    else setOnlineModalOpen(true)
  }

  const handlePay = () => {
    openPaymentModal(paymentMethod)
  }

  const openPosReceipt = (opts: {
    invoiceNo: string
    paidAmount: number
    totalPayable: number
    taxRate: number
    discountAmount: number
    cartItems: PosCartItem[]
    cashier: string
    confirmedAt: string
  }) => {
    const lineItems = opts.cartItems.map((item) => ({
      name: item.name,
      unitPrice: Math.max(0, Number(item.price) || 0),
      qty: Math.max(1, Number(item.quantity) || 1),
      total: Math.max(0, Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1),
    }))
    const catalogSubtotal = lineItems.reduce((sum, row) => sum + row.total, 0)
    const {
      subTotal,
      discount,
      vatAmount,
      taxRate: receiptTaxRate,
      totalAmount,
    } = resolveReceiptFinancials({
      catalogSubtotal,
      totalAmount: opts.totalPayable,
      taxRate: opts.taxRate,
      discount: opts.discountAmount,
      dueCollected: 0,
    })

    const cashReceived = Math.max(0, opts.paidAmount)
    const paymentStatus =
      cashReceived <= 0
        ? ("Unpaid" as const)
        : cashReceived + 0.001 >= totalAmount
          ? ("Paid" as const)
          : ("Partial" as const)

    const bName = resolveBusinessName(businessName)
    const html = buildInvoiceReceiptHtml({
      brandName: receiptBrandFromBusinessName(bName),
      companyName: receiptCompanyFromBusinessName(businessInfo?.businessName || bName),
      address: businessInfo?.address || undefined,
      vatRegNo: businessInfo?.gstNumber?.trim() || undefined,
      cashier: opts.cashier || undefined,
      terminalId: "POS",
      invoiceNo: opts.invoiceNo,
      dateTimeLabel: formatReceiptDateTime(opts.confirmedAt),
      lineItems,
      subTotal,
      discount,
      taxRate: receiptTaxRate,
      vatAmount,
      totalAmount,
      dueCollected: 0,
      cashReceived,
      paymentStatus,
      supportPhone: businessInfo?.phone || undefined,
    })

    const win = window.open("", "_blank", "width=420,height=900")
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to print the receipt.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const submitInvoice = async (opts: {
    amountReceived: number
    method: "Cash" | "bKash" | "Nagad" | "Bank" | "Card"
    stylist: string
    orderTakenBy: string
    note?: string
  }) => {
    if (!customer?.id || !customer.name?.trim() || !customer.phone?.trim()) {
      toast.error("Customer info is required to complete payment")
      setCashModalOpen(false)
      setOnlineModalOpen(false)
      return false
    }

    const { services, packageNames } = expandCartByType(items)
    if (services.length === 0 && packageNames.length === 0) {
      toast.error("Select a service or package before payment")
      return false
    }

    const paidAmount = Math.min(Math.max(0, opts.amountReceived), totalPayable)
    // 0 received is allowed (full due / pay-later). Still clamps to payable.
    const fullyPaid = paidAmount + 0.009 >= totalPayable
    const cartSnapshot = items.map((item) => ({ ...item }))
    const confirmedAt = new Date().toISOString()
    const taxSnapshot = taxRate
    const discountSnapshot = discountAmount
    const totalSnapshot = totalPayable
    const stylistName = opts.stylist.trim()
    const takenBy = opts.orderTakenBy.trim() || orderTakenBy

    setSubmittingPayment(true)
    try {
      const created: any = await createInvoice({
        clientId: customer.id,
        services: services.length ? services : undefined,
        packageNames: packageNames.length ? packageNames : undefined,
        source: "offline",
        staff: stylistName || undefined,
        printBy: fullyPaid ? takenBy : undefined,
        total: totalSnapshot,
        skipTax: true,
        paidAmount,
        paymentMethod: opts.method,
        // Only set Paid explicitly when fully paid (requires printBy — already set)
        status: fullyPaid ? "Paid" : undefined,
        confirmedAt,
        applyCommission: false,
        // Freeze the tax % and discount used for this transaction — otherwise a later
        // settings change or reprint would silently rewrite/lose them.
        taxRate: taxSnapshot,
        discount: discountSnapshot,
      })

      const invNo = created?.invoiceNumber ?? created?.data?.invoiceNumber
      if (!invNo) {
        toast.error("Invoice created but invoice number was not returned")
        return false
      }

      const createdId = created?.id ?? created?.data?.id
      if (createdId) markInvoiceUnread(String(createdId))

      toast.success(`Invoice ${invNo} created · ${opts.method}`)

      // Open thermal receipt immediately — same layout as Invoices / Client History
      openPosReceipt({
        invoiceNo: String(invNo),
        paidAmount,
        totalPayable: totalSnapshot,
        taxRate: taxSnapshot,
        discountAmount: discountSnapshot,
        cartItems: cartSnapshot,
        cashier: takenBy,
        confirmedAt,
      })

      setCashModalOpen(false)
      setOnlineModalOpen(false)
      setInvoiceNo(String(invNo))
      resetSale({ keepInvoiceNo: true })
      setClientsRefreshKey((k) => k + 1)
      refreshPosCollectionSummary()
      return true
    } catch (err: any) {
      console.error(err)
      const message = err?.response?.data?.message
      toast.error(
        Array.isArray(message)
          ? message.join(", ")
          : message || "Failed to create invoice",
      )
      return false
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleCashConfirm = async (payload: {
    amountReceived: number
    amountDue: number
    stylist: string
    orderTakenBy: string
    note: string
  }) => {
    await submitInvoice({
      amountReceived: payload.amountReceived,
      method: "Cash",
      stylist: payload.stylist,
      orderTakenBy: payload.orderTakenBy,
      note: payload.note,
    })
  }

  const handleOnlineConfirm = async (payload: {
    amountReceived: number
    method: PosOnlineMethod
    stylist: string
    orderTakenBy: string
    note: string
  }) => {
    await submitInvoice({
      amountReceived: payload.amountReceived,
      method: payload.method,
      stylist: payload.stylist,
      orderTakenBy: payload.orderTakenBy,
      note: payload.note,
    })
  }

  return (
    <>
      <aside
        className={cn(
          "flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-brand-line bg-white xl:min-h-[560px]",
          className
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-4 sm:p-3.5">
          <h2 className="text-base font-semibold text-brand-ink sm:text-lg">Transaction Details</h2>

          <PosTransactionActions
            invoiceNo={invoiceNo}
            heldCount={heldTransactions.length}
            onHold={handleHold}
            onViewHolds={handleViewHolds}
            onNew={handleNew}
            onReset={handleReset}
          />

          <PosCustomerDetails
            customer={customer}
            visitType={visitType}
            clientsRefreshKey={clientsRefreshKey}
            onSelectCustomer={setCustomer}
            onVisitTypeChange={setVisitType}
            onAddCustomer={openAddCustomer}
          />

          <PosPaymentSummary
            subTotal={subTotal}
            taxRate={taxRate}
            taxAmount={taxAmount}
            discountType={discountType}
            discountValue={discountValue}
            discountAmount={discountAmount}
            totalPayable={totalPayable}
            onDiscountClick={() => setDiscountOpen(true)}
            onTaxClick={() => setTaxModalOpen(true)}
          />
        </div>

        <div className="relative z-10 shrink-0 border-t border-brand-line bg-brand-mist/40 px-3.5 py-2.5">
          {(!customer?.id || !customer.name?.trim() || !customer.phone?.trim()) && (
            <p className="mb-2 text-xs font-medium text-amber-700">
              Select or add a customer to enable payment.
            </p>
          )}
          <PosSelectPayment
            method={paymentMethod}
            totalPayable={totalPayable}
            onMethodChange={setPaymentMethod}
            onCashClick={() => openPaymentModal("cash")}
            onOnlineClick={() => openPaymentModal("online")}
            onPay={handlePay}
            disabled={
              items.length === 0 ||
              submittingPayment ||
              !customer?.id ||
              !customer.name?.trim() ||
              !customer.phone?.trim()
            }
          />
        </div>
      </aside>

      <PosCashPaymentModal
        open={cashModalOpen}
        onOpenChange={setCashModalOpen}
        totalPayable={totalPayable}
        employeeNames={employeeNames}
        orderTakenBy={orderTakenBy}
        submitting={submittingPayment}
        onConfirm={handleCashConfirm}
      />

      <PosOnlinePaymentModal
        open={onlineModalOpen}
        onOpenChange={setOnlineModalOpen}
        totalPayable={totalPayable}
        employeeNames={employeeNames}
        orderTakenBy={orderTakenBy}
        submitting={submittingPayment}
        onConfirm={handleOnlineConfirm}
      />

      <PosTaxModal
        open={taxModalOpen}
        onOpenChange={setTaxModalOpen}
        taxRate={taxRate}
        onSubmit={handleTaxSubmit}
        onRemove={handleTaxRemove}
      />

      <PosDiscountModal
        open={discountOpen}
        onOpenChange={setDiscountOpen}
        discountType={discountType}
        discountValue={discountValue}
        onSubmit={handleDiscountSubmit}
        onRemove={handleDiscountRemove}
      />

      <PosHeldTransactionsDialog
        open={holdsOpen}
        onOpenChange={setHoldsOpen}
        holds={heldTransactions}
        onRecall={handleRecallHold}
        onDelete={handleDeleteHold}
        onRemoveAll={handleRemoveAllHolds}
      />

      <AlertDialog
        open={pendingRecall !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRecall(null)
        }}
      >
        <AlertDialogContent className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle>Recall held transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active sale in progress. It will be{" "}
              <span className="font-medium text-foreground">held automatically</span> before the
              selected transaction is restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRecallWithAutoHold}>
              Hold current &amp; recall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setNewName("")
            setNewPhone("")
            setNewCustomerErrors({})
          }
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => {
                  const val = e.target.value
                  setNewName(val)
                  if (val.trim()) {
                    setNewCustomerErrors((prev) => ({ ...prev, name: undefined }))
                  }
                }}
                placeholder="e.g. Alex Rahman"
                className={newCustomerErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {newCustomerErrors.name && (
                <p className="text-[12px] text-destructive">{newCustomerErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={newPhone}
                onChange={(e) => {
                  const val = e.target.value
                  setNewPhone(val)
                  let phoneError: string | undefined
                  if (val.trim() && !isValidBangladeshiPhone(val)) {
                    phoneError = "Please enter a valid Bangladeshi phone number (e.g. 01712345678)"
                  }
                  setNewCustomerErrors((prev) => ({ ...prev, phone: phoneError }))
                }}
                placeholder="e.g. 01712345678"
                inputMode="tel"
                className={newCustomerErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {newCustomerErrors.phone && (
                <p className="text-[12px] text-destructive">{newCustomerErrors.phone}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomer} disabled={savingCustomer} accessAction="create" accessFeature="clients">
              {savingCustomer ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
