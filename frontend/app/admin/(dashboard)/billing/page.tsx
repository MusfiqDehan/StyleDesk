"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useMemo, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@admin/hooks/use-auth"
import { getPosOrderTakerDisplay } from "@admin/components/pos/pos-utils"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { useDebounce } from "@/hooks/use-debounce"
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from "@admin/api/billing/billing"
import {
  loadUnreadInvoiceIds,
  markInvoiceRead,
  markInvoiceUnread,
  pruneUnreadInvoiceIds,
  UNREAD_INVOICES_EVENT,
} from "@admin/lib/invoice-unread"
import { getClientByPhone, createClient } from "@admin/api/clients/clients"
import { getStylists } from "@admin/api/employees/employees"
import { getActiveServices } from "@admin/api/services/services"
import { getPackages } from "@admin/api/packages/packages"
import { getInvoiceSettings } from "@admin/api/settings/settings"
import { useBusiness } from "@/context/BusinessContext"
import { resolveBusinessName } from "@/lib/business-branding"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Search, Receipt, Printer, MoreHorizontal, Download, Eye, Pencil, Trash2, User, UserCheck, Scissors, Calendar, Calendar as CalendarIcon, Globe, Zap, Phone, X, Store, Loader2, CheckCircle2, UserPlus, ChevronDown, CreditCard } from "lucide-react"
import { toast } from '@/lib/toast'
import { AdminPageHeader, AdminHeaderPrimaryButton, AdminHeaderSecondaryButton, AdminHeaderDangerButton } from "@admin/components/admin-page-header"
import { InvoiceKpiCards } from "@admin/components/invoice-kpi-cards"
import { InvoiceDetailsTable } from "@admin/components/invoice/invoice-details-table"
import { InvoiceDetailsModal } from "@admin/components/invoice/invoice-details-modal"
import type { InvoiceStatusFilterValue } from "@admin/components/invoice/invoice-status-filter"
import type { InvoiceDateFilterValue } from "@admin/components/invoice/invoice-date-filter"
import {
  EMPTY_CATALOG_FILTER,
  invoiceMatchesCatalogFilter,
  type InvoiceCatalogFilterValue,
} from "@admin/components/invoice/invoice-service-filter"
import {
  deriveInvoiceStatus,
  type InvoiceStatusValue,
} from "@admin/components/invoice/invoice-status-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency, cn } from "@/lib/utils"
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
  invoiceNo: string
  client: string
  clientPhone: string
  services: string[]
  packageNames?: string[]
  amount: number
  paidAmount?: number
  paymentMethod: string
  staff: string
  printBy?: string
  sortAt: string
  date: string
  status: InvoiceStatusValue
  source: "online" | "offline"
  /** Tax % snapshotted on the linked booking (null = use settings / reverse from total). */
  taxRate?: number | null
  discount?: number
  /** Prior due collected on this invoice (POS Due Collection) */
  dueCollected?: number
  /** Outstanding due when collection was added */
  priorDueSnapshot?: number | null
}

const PAGE_SIZE = 10

function splitPackageNames(value?: string | string[] | null) {
  if (!value) return [] as string[]
  if (Array.isArray(value)) return value.map((s) => String(s || "").trim()).filter(Boolean)
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapInvoice(inv: any, packageCatalogNames?: Set<string>): Invoice {
  const sortAt = inv.confirmedAt ?? inv.createdAt ?? ""
  const amount = Number(inv.total)
  const paidAmount = inv.paidAmount != null ? Number(inv.paidAmount) : undefined
  const rawServices = Array.isArray(inv.services)
    ? inv.services.map((s: string) => String(s || "").trim()).filter(Boolean)
    : []
  // Booking source of truth — preserves qty (repeated names). Never collapse with Set.
  const fromApptPackages = splitPackageNames(inv.appointment?.packageName)
  const fromStoredPackages = splitPackageNames(inv.packageNames)
  const apptServices = Array.isArray(inv.appointment?.services)
    ? inv.appointment.services.map((s: string) => String(s || "").trim()).filter(Boolean)
    : []
  const detectedFromServices = packageCatalogNames?.size
    ? rawServices.filter((name: string) => packageCatalogNames.has(name))
    : []

  // Prefer appointment package list (has qty) over invoice storage that may be unique-only
  const packageNames =
    fromApptPackages.length > 0
      ? fromApptPackages
      : fromStoredPackages.length > 0
        ? fromStoredPackages
        : detectedFromServices

  const packageNameSet = new Set(packageNames)
  const invoiceOnlyServices = rawServices.filter((name: string) => !packageNameSet.has(name))
  const apptOnlyServices = apptServices.filter((name: string) => !packageNameSet.has(name))
  // Prefer appointment services when they carry more quantity
  const services =
    apptOnlyServices.length > invoiceOnlyServices.length
      ? apptOnlyServices
      : invoiceOnlyServices.length > 0
        ? invoiceOnlyServices
        : apptOnlyServices

  // POS → Walk In (offline, no appointment). Bookings → Online (appointment-linked).
  // Legacy booking invoices were stored as offline; appointment link corrects the display.
  const hasAppointment = Boolean(inv.appointmentId || inv.appointment?.id)
  const sourceRaw = (inv.source || "").toString().toLowerCase()
  const source: "online" | "offline" = hasAppointment
    ? "online"
    : sourceRaw.includes("online")
      ? "online"
      : "offline"

  return {
    id: inv.id,
    invoiceNo: inv.invoiceNumber,
    client: inv.client?.name ?? "Walk-in",
    clientPhone: inv.client?.phone ?? "?",
    services,
    packageNames,
    amount,
    paidAmount,
    paymentMethod: inv.paymentMethod,
    staff: inv.staff ?? "?",
    printBy: inv.printBy?.trim() || undefined,
    sortAt,
    date: sortAt
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Dhaka",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(sortAt))
      : "",
    status: deriveInvoiceStatus(amount, paidAmount),
    source,
    // Prefer invoice snapshot, then booking snapshot — never live settings
    taxRate:
      inv.taxRate != null && Number.isFinite(Number(inv.taxRate))
        ? Number(inv.taxRate)
        : inv.appointment?.taxRate != null && Number.isFinite(Number(inv.appointment.taxRate))
          ? Number(inv.appointment.taxRate)
          : null,
    // Prefer invoice's own snapshot (POS), then the linked booking's discount
    discount:
      inv.discount != null && Number.isFinite(Number(inv.discount))
        ? Number(inv.discount)
        : inv.appointment?.discount != null
          ? Number(inv.appointment.discount)
          : 0,
    dueCollected:
      inv.dueCollected != null && Number.isFinite(Number(inv.dueCollected))
        ? Math.max(0, Number(inv.dueCollected))
        : 0,
    priorDueSnapshot:
      inv.priorDueSnapshot != null && Number.isFinite(Number(inv.priorDueSnapshot))
        ? Math.max(0, Number(inv.priorDueSnapshot))
        : null,
  }
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

function getStatusLabel(status: InvoiceStatusValue) {
  return status
}

export default function BillingPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const cashierLabel = getPosOrderTakerDisplay(user)
  const { businessName, businessInfo } = useBusiness()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [timeFilter, setTimeFilter] = useState<InvoiceDateFilterValue>(() => {
    const dateParam = searchParams.get("date")?.toLowerCase()
    return dateParam === "today" ? "today" : "all"
  })
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilterValue>("all")
  const [catalogFilter, setCatalogFilter] = useState<InvoiceCatalogFilterValue>(EMPTY_CATALOG_FILTER)
  const [billingFromOpen, setBillingFromOpen] = useState(false)
  const [billingToOpen, setBillingToOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [viewIsSaving, setViewIsSaving] = useState(false)
  const [editInvoiceState, setEditInvoiceState] = useState<Invoice | null>(null)
  const [deleteInvoiceState, setDeleteInvoiceState] = useState<Invoice | null>(null)
  const [clearInvoicesOpen, setClearInvoicesOpen] = useState(false)
  const [isClearingInvoices, setIsClearingInvoices] = useState(false)
  const [unreadInvoiceIds, setUnreadInvoiceIds] = useState<Set<string>>(() => loadUnreadInvoiceIds())

  // Add Billing (offline) modal state
  const [isAddBillingOpen, setIsAddBillingOpen] = useState(false)
  const [offlineClientPhone, setOfflineClientPhone] = useState("")
  const [offlineClientName, setOfflineClientName] = useState("")
  const [offlineClientId, setOfflineClientId] = useState<string | null>(null)
  const [clientLookupStatus, setClientLookupStatus] = useState<"idle" | "found" | "new">("idle")
  const [isPhoneLookingUp, setIsPhoneLookingUp] = useState(false)
  const [offlineServices, setOfflineServices] = useState<string[]>([])
  const [offlinePackages, setOfflinePackages] = useState<string[]>([])
  const [offlineCatalogTab, setOfflineCatalogTab] = useState<"services" | "packages">("services")
  const [serviceSelectValue, setServiceSelectValue] = useState("")
  const [serviceOptions, setServiceOptions] = useState<{ id: string; name: string; price: number; category: string; commission: number }[]>([])
  const [packageOptions, setPackageOptions] = useState<{ name: string; price: number }[]>([])
  const [offlineAmount, setOfflineAmount] = useState("")
  /** Settings → Billing default; used to reset modal tax. */
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)
  /** Per-invoice tax % — does not write back to Settings. */
  const [offlineTaxRate, setOfflineTaxRate] = useState(0)
  const [offlinePaymentMethod, setOfflinePaymentMethod] = useState<
    "Cash" | "bKash" | "Nagad" | "Bank" | "Card"
  >("Cash")
  const [offlineStaff, setOfflineStaff] = useState("")
  const [offlinePaidAmount, setOfflinePaidAmount] = useState("")
  const [isAddBillingSubmitting, setIsAddBillingSubmitting] = useState(false)
  const [invoiceSource, setInvoiceSource] = useState<"online" | "offline">("offline")
  const [stylists, setStylists] = useState<{ id: string; name: string }[]>([])
  const [offlineDate, setOfflineDate] = useState<Date>(new Date())
  const [offlineDateOpen, setOfflineDateOpen] = useState(false)
  const [applyCommission, setApplyCommission] = useState(true)
  const debouncedOfflinePhone = useDebounce(offlineClientPhone, 600)

  const fetchInvoices = async (noCache = false) => {
    try {
      const res = await getInvoices(1, 1000, noCache)
      const packageCatalogNames = new Set(packageOptions.map((p) => p.name))
      const raw = res?.data ?? res
      const mapped = (Array.isArray(raw) ? raw : []).map((inv: any) => mapInvoice(inv, packageCatalogNames))
      mapped.sort((a: Invoice, b: Invoice) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
      setInvoices(mapped)
      setUnreadInvoiceIds(pruneUnreadInvoiceIds(mapped.map((inv) => inv.id)))
    } catch (err) {
      console.error(err)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices(true)
  }, [packageOptions])

  useEffect(() => {
    const sync = () => setUnreadInvoiceIds(loadUnreadInvoiceIds())
    window.addEventListener(UNREAD_INVOICES_EVENT, sync)
    window.addEventListener("storage", sync)
    sync()
    return () => {
      window.removeEventListener(UNREAD_INVOICES_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  useEffect(() => {
    if (pathname === "/admin/billing" || pathname === "/admin/all-orders") {
      router.replace("/admin/invoices")
    }
  }, [pathname, router])

  // Load stylists for the dropdown once on mount
  useEffect(() => {
    getStylists(true)
      .then((data: any) => {
        const list = data.data ?? data
        setStylists(Array.isArray(list) ? list.map((e: any) => ({ id: e.id, name: e.name })) : [])
      })
      .catch(console.error)
  }, [])

  // Load active services for the dropdown once on mount
  useEffect(() => {
    getActiveServices(true)
      .then((data: any) => {
        const list = data.data ?? data
        setServiceOptions(
          Array.isArray(list)
            ? list.map((s: any) => ({ id: s.id, name: s.name, price: Number(s.price) || 0, category: s.category ?? "", commission: Number(s.commission) || 0 }))
            : []
        )
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    getPackages(true)
      .then((data: any) => {
        const list = data.data ?? data
        setPackageOptions(
          Array.isArray(list)
            ? list.map((p: any) => ({
                name: p.title ?? p.name ?? "",
                price: Number(p.price) || 0,
              })).filter((p: { name: string }) => Boolean(p.name))
            : []
        )
      })
      .catch(console.error)
  }, [])

  // Settings → Billing tax rate (global default for Add Billing)
  useEffect(() => {
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate == null || Number.isNaN(Number(settings.taxRate))) return
        const rate = Number(settings.taxRate)
        setDefaultTaxRate(rate)
        setOfflineTaxRate(rate)
      })
      .catch(console.error)
  }, [])

  // Phone-number lookup ? auto-fill client name if found
  useEffect(() => {
    if (!debouncedOfflinePhone || debouncedOfflinePhone.replace(/\D/g, "").length !== 11 || !debouncedOfflinePhone.startsWith("01")) {
      setOfflineClientId(null)
      setClientLookupStatus("idle")
      return
    }
    let cancelled = false
    setIsPhoneLookingUp(true)
    getClientByPhone(debouncedOfflinePhone)
      .then((res: any) => {
        if (cancelled) return
        const client = res?.data ?? res
        if (client?.name) {
          setOfflineClientName(client.name)
          setOfflineClientId(client.id ?? null)
          setClientLookupStatus("found")
        } else {
          setOfflineClientId(null)
          setClientLookupStatus("new")
        }
      })
      .catch(() => {
        if (cancelled) return
        setOfflineClientId(null)
        setClientLookupStatus("new")
      })
      .finally(() => { if (!cancelled) setIsPhoneLookingUp(false) })
    return () => { cancelled = true }
  }, [debouncedOfflinePhone])

  const filterByDate = (date: string) => {
    if (timeFilter === "all") return true
    const now = new Date()
    const itemDate = new Date(date)
    if (Number.isNaN(itemDate.getTime())) return false
    switch (timeFilter) {
      case "today": {
        const todayStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Dhaka",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now)
        return String(date).slice(0, 10) === todayStr
      }
      case "month":
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        )
      case "6months":
        return itemDate >= new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      case "year":
        return itemDate >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return true
    }
  }

  const dateFilteredInvoices = useMemo(() => {
    return invoices.filter((inv) => filterByDate(inv.date))
  }, [invoices, timeFilter])

  const catalogFilteredInvoices = useMemo(() => {
    return dateFilteredInvoices.filter((inv) =>
      invoiceMatchesCatalogFilter(inv, catalogFilter, serviceOptions),
    )
  }, [dateFilteredInvoices, catalogFilter, serviceOptions])

  const filteredInvoices = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return catalogFilteredInvoices.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.client.toLowerCase().includes(q) ||
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.clientPhone.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "due"
          ? inv.status === "Unpaid" || inv.status === "Partial"
          : inv.status === statusFilter)
      return matchesSearch && matchesStatus
    })
  }, [catalogFilteredInvoices, debouncedSearch, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, timeFilter, statusFilter, catalogFilter])

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredInvoices, row => String(row.id))
  const paginatedInvoices = cursorTable.data


  const handleEditSave = async () => {
    if (!editInvoiceState) return
    try {
      const paidAmount =
        editInvoiceState.status === "Paid"
          ? editInvoiceState.amount
          : editInvoiceState.status === "Unpaid"
            ? 0
            : (editInvoiceState.paidAmount ?? 0)
      const nextStatus = resolveBackendInvoiceStatus(editInvoiceState.amount, paidAmount)
      await updateInvoice(editInvoiceState.id, {
        total: editInvoiceState.amount,
        status: nextStatus,
        paymentMethod: editInvoiceState.paymentMethod,
        paidAmount,
        applyCommission:
          nextStatus === "Paid" &&
          !!editInvoiceState.staff &&
          editInvoiceState.staff !== "?" &&
          editInvoiceState.staff !== "?",
      })
      setEditInvoiceState(null)
      fetchInvoices()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!deleteInvoiceState) return
    try {
      await deleteInvoice(deleteInvoiceState.id)
      setUnreadInvoiceIds(markInvoiceRead(deleteInvoiceState.id))
      setDeleteInvoiceState(null)
      fetchInvoices()
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearAllInvoices = async () => {
    if (invoices.length === 0) {
      setClearInvoicesOpen(false)
      toast.message("No invoices to clear")
      return
    }
    try {
      setIsClearingInvoices(true)
      const results = await Promise.allSettled(
        invoices.map((inv) => deleteInvoice(inv.id)),
      )
      const failed = results.filter((r) => r.status === "rejected").length
      const deleted = results.length - failed
      setClearInvoicesOpen(false)
      if (failed > 0) {
        toast.error(`Cleared ${deleted} invoices, ${failed} failed`)
      } else {
        toast.success(`Cleared ${deleted} invoice${deleted === 1 ? "" : "s"}`)
      }
      fetchInvoices()
    } catch (err) {
      console.error("Failed to clear invoices", err)
      toast.error("Failed to clear invoices")
    } finally {
      setIsClearingInvoices(false)
    }
  }

  const resetOfflineForm = () => {
    setOfflineClientPhone("")
    setOfflineClientName("")
    setOfflineClientId(null)
    setClientLookupStatus("idle")
    setIsPhoneLookingUp(false)
    setInvoiceSource("offline")
    setOfflineServices([])
    setOfflinePackages([])
    setOfflineCatalogTab("services")
    setServiceSelectValue("")
    setOfflineAmount("")
    setOfflineTaxRate(defaultTaxRate)
    setOfflinePaymentMethod("Cash")
    setOfflineStaff("")
    setOfflinePaidAmount("")
    setOfflineDate(new Date())
    setApplyCommission(true)
  }

  const openAddBillingModal = () => {
    resetOfflineForm()
    getInvoiceSettings()
      .then((settings) => {
        if (settings?.taxRate == null || Number.isNaN(Number(settings.taxRate))) return
        const rate = Number(settings.taxRate)
        setDefaultTaxRate(rate)
        setOfflineTaxRate(rate)
      })
      .catch(() => {
        setOfflineTaxRate(defaultTaxRate)
      })
    setIsAddBillingOpen(true)
  }

  const computeOfflinePayable = (subtotalRaw: number, taxRateRaw: number) => {
    const subtotal = Math.max(0, Number(subtotalRaw) || 0)
    const taxRate = Math.min(100, Math.max(0, Number(taxRateRaw) || 0))
    // Ceil (not round) to match booking-confirm and receipt VAT rounding everywhere else
    const taxAmount = Math.ceil((subtotal * taxRate) / 100)
    const total = Math.round((subtotal + taxAmount) * 100) / 100
    return { subtotal, taxRate, taxAmount, total }
  }

  const recalcOfflineTotal = (services: string[], packages: string[]) => {
    const serviceTotal = services.reduce((sum, name) => {
      const match = serviceOptions.find((o) => o.name === name)
      return sum + (match?.price ?? 0)
    }, 0)
    const packageTotal = packages.reduce((sum, name) => {
      const match = packageOptions.find((o) => o.name === name)
      return sum + (match?.price ?? 0)
    }, 0)
    const total = serviceTotal + packageTotal
    setOfflineAmount(total > 0 ? String(total) : "")
  }

  const handleAddService = (serviceName: string) => {
    const updated = [...offlineServices, serviceName]
    setOfflineServices(updated)
    recalcOfflineTotal(updated, offlinePackages)
  }

  const handleRemoveService = (idx: number) => {
    const updated = offlineServices.filter((_, i) => i !== idx)
    setOfflineServices(updated)
    recalcOfflineTotal(updated, offlinePackages)
  }

  const handleAddPackage = (packageName: string) => {
    const updated = [...offlinePackages, packageName]
    setOfflinePackages(updated)
    recalcOfflineTotal(offlineServices, updated)
  }

  const handleRemovePackage = (idx: number) => {
    const updated = offlinePackages.filter((_, i) => i !== idx)
    setOfflinePackages(updated)
    recalcOfflineTotal(offlineServices, updated)
  }

  const handleAddBillingSubmit = async () => {
    const validServices = offlineServices.filter((s) => s.trim())
    const validPackages = offlinePackages.filter((s) => s.trim())
    const lineItems = [...validServices, ...validPackages]
    const phoneDigits = offlineClientPhone.replace(/\D/g, "")

    if (!offlineClientPhone.startsWith("01") || phoneDigits.length !== 11) {
      toast.error("Enter a valid 11-digit phone number starting with 01")
      return
    }
    if (!offlineClientName.trim()) {
      toast.error("Client name is required")
      return
    }
    if (!lineItems.length) {
      toast.error("Select at least one service or package")
      return
    }
    if (!offlineAmount) {
      toast.error("Amount is required — select items first")
      return
    }
    const { total: totalAmt } = computeOfflinePayable(
      parseFloat(offlineAmount),
      offlineTaxRate,
    )
    if (isNaN(totalAmt) || totalAmt <= 0) {
      toast.error("Amount must be greater than 0")
      return
    }

    const rawPaid = Number.parseFloat(offlinePaidAmount)
    const paidAmt =
      offlinePaidAmount.trim() === "" || !Number.isFinite(rawPaid)
        ? 0
        : Math.min(totalAmt, Math.max(0, rawPaid))
    const offlineStatus = resolveBackendInvoiceStatus(totalAmt, paidAmt)

    if (offlineStatus === "Paid" && !offlineStaff.trim()) {
      toast.error("Artist is required when the invoice is fully paid")
      return
    }

    setIsAddBillingSubmitting(true)
    try {
      let resolvedClientId = offlineClientId
      if (!resolvedClientId) {
        const created = await createClient({
          name: offlineClientName.trim(),
          phone: offlineClientPhone.trim(),
        })
        resolvedClientId = (created?.data ?? created)?.id ?? null
      }

      const created = await createInvoice({
        clientId: resolvedClientId ?? undefined,
        services: validServices,
        packageNames: validPackages.length ? validPackages : undefined,
        source: invoiceSource,
        staff: offlineStaff.trim() || undefined,
        printBy: offlineStatus === "Paid" ? cashierLabel : undefined,
        total: totalAmt,
        paymentMethod: offlinePaymentMethod,
        status: offlineStatus,
        paidAmount: paidAmt,
        confirmedAt: offlineDate.toISOString(),
        applyCommission:
          offlineStatus === "Paid" &&
          !!offlineStaff.trim() &&
          applyCommission &&
          validServices.length > 0,
        skipTax: true,
        // Freeze the tax % used for this POS invoice (settings changes must not rewrite it)
        taxRate: Math.min(100, Math.max(0, Number(offlineTaxRate) || 0)),
      })
      const createdId = (created as any)?.id ?? (created as any)?.data?.id
      if (createdId) markInvoiceUnread(String(createdId))
      toast.success("Invoice created")
      resetOfflineForm()
      setIsAddBillingOpen(false)
      fetchInvoices()
    } catch (err: any) {
      console.error(err)
      const message = err?.response?.data?.message
      toast.error(Array.isArray(message) ? message.join(", ") : message || "Failed to create invoice")
    } finally {
      setIsAddBillingSubmitting(false)
    }
  }

  const openInvoiceDetails = (invoice: Invoice) => {
    setUnreadInvoiceIds(markInvoiceRead(invoice.id))
    setViewInvoice(invoice)
  }

  const handleRecordPayment = async (invoice: Invoice, paymentAmount: number) => {
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
          invoice.staff !== "N/A",
      })
      toast.success(
        nextStatus === "Paid"
          ? "Payment recorded - invoice is fully paid"
          : `Payment of ${formatCurrency(installment)} recorded`,
      )
      setViewInvoice(null)
      fetchInvoices()
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Failed to record payment")
      console.error(err)
    } finally {
      setViewIsSaving(false)
    }
  }

  const handlePrintInvoice = (invoice: Invoice) => {
    const netPayable = Math.max(0, Number(invoice.amount) || 0)

    const bName = resolveBusinessName(businessName)
    const brand = receiptBrandFromBusinessName(bName)
    const company = receiptCompanyFromBusinessName(businessInfo?.businessName || bName)
    const bAddress = businessInfo?.address || ""
    const bPhone = businessInfo?.phone || ""
    const bGst = businessInfo?.gstNumber?.trim() || ""

    const priceMap = new Map<string, number>()
    for (const s of serviceOptions) priceMap.set(s.name, s.price)
    for (const p of packageOptions) {
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
    const discountAmount = Number(invoice.discount) || 0
    const dueCollected = Math.max(0, Number(invoice.dueCollected) || 0)

    // Frozen invoice/booking tax only — never fall back to live settings.
    // Reconcile against goods total (exclude due collection — it is not taxed).
    const taxRate = resolveInvoiceTaxRate({
      snapshottedRate: invoice.taxRate,
      catalogSubtotal,
      totalAmount: Math.max(0, netPayable - dueCollected),
      discount: discountAmount,
    })
    const {
      subTotal,
      discount,
      vatAmount,
      taxRate: receiptTaxRate,
      totalAmount,
    } = resolveReceiptFinancials({
      catalogSubtotal,
      totalAmount: netPayable,
      taxRate,
      discount: discountAmount,
      dueCollected,
    })

    const dateSource = invoice.sortAt || invoice.date
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
      dateTimeLabel: formatReceiptDateTime(dateSource),
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
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const handleExportCSV = () => {
    const headers = ["Invoice No", "Client", "Services", "Amount", "Artist", "Payment Method", "Date", "Status"]
    const rows = filteredInvoices.map(inv => [inv.invoiceNo, inv.client, inv.services.join("; "), inv.amount, inv.staff, inv.paymentMethod, inv.date, getStatusLabel(inv.status)])
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-700"
      case "Unpaid": return "bg-amber-100 text-amber-700"
      case "Partial": return "bg-blue-100 text-brand-deep"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <>
      <div className={DASH_PAGE}>
        <AdminPageHeader
          title="Invoices"
          subtitle="View, print, and manage invoices for salon sales"
          actions={
            <>
            <AdminHeaderDangerButton
              onClick={() => setClearInvoicesOpen(true)}
              disabled={invoices.length === 0 || isClearingInvoices}
            >
              <Trash2 />
              Clear Invoices
            </AdminHeaderDangerButton>
            <AdminHeaderSecondaryButton onClick={handleExportCSV} accessAction="export">
              <Download />
              Export CSV
            </AdminHeaderSecondaryButton>
            <AdminHeaderPrimaryButton onClick={openAddBillingModal} accessAction="create">
              <Plus />
              Add Billing
            </AdminHeaderPrimaryButton>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              {/* <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button></DialogTrigger> */}
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>Automatic Invoice Generation</DialogTitle>
                </DialogHeader>
                <div className="py-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Important Information</p>
                    <p className="text-sm text-muted-foreground leading-relaxed px-2">
                      For invoice you must have to add an appointment then confirm it, the invoice will auto genarate.
                    </p>
                  </div>
                  <Button onClick={() => setIsDialogOpen(false)} className="w-full mt-2">
                    Understood
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </>
          }
        />

        <InvoiceKpiCards
          invoices={catalogFilteredInvoices}
          className="mb-6"
          totalDueActive={statusFilter === "due"}
          onTotalDueClick={() => {
            setStatusFilter((prev) => (prev === "due" ? "all" : "due"))
            setCurrentPage(1)
          }}
        />

        <InvoiceDetailsTable cursorPagination={cursorTable}
          invoices={paginatedInvoices}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateFilter={timeFilter}
          onDateFilterChange={setTimeFilter}
          catalogFilter={catalogFilter}
          onCatalogFilterChange={setCatalogFilter}
          serviceOptions={serviceOptions.map((s) => ({ name: s.name, category: s.category }))}
          packageOptions={packageOptions}
          totalEntries={filteredInvoices.length}
          unreadInvoiceIds={unreadInvoiceIds}
          onView={(inv) => openInvoiceDetails(inv as Invoice)}
          onPrint={(inv) => handlePrintInvoice(inv as Invoice)}
          onDelete={(inv) => setDeleteInvoiceState(inv as Invoice)}
          className="mb-6"
        />
      </div>

      <InvoiceDetailsModal
        invoice={viewInvoice}
        open={!!viewInvoice}
        saving={viewIsSaving}
        serviceCatalog={serviceOptions.map((s) => ({ name: s.name, price: s.price }))}
        packageCatalog={packageOptions}
        onOpenChange={(open) => {
          if (!open) setViewInvoice(null)
        }}
        onPrint={(inv) => handlePrintInvoice(inv as Invoice)}
        onRecordPayment={(inv, amount) => handleRecordPayment(inv as Invoice, amount)}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editInvoiceState} onOpenChange={() => setEditInvoiceState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          {editInvoiceState && (
            <div className="space-y-4 mt-4 pb-2">
              <div>
                <Label>Amount (?)</Label>
                <Input placeholder="e.g. 1500" type="number" value={editInvoiceState.amount} onChange={(e) => setEditInvoiceState({ ...editInvoiceState, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={editInvoiceState.paymentMethod} onValueChange={(v) => setEditInvoiceState({ ...editInvoiceState, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="bKash">bKash</SelectItem>
                    <SelectItem value="Nagad">Nagad</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editInvoiceState.status} onValueChange={(v: InvoiceStatusValue) => setEditInvoiceState({ ...editInvoiceState, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editInvoiceState.status === "Partial" && (
                <div>
                  <Label>Amount Paid (?)</Label>
                  <Input
                    type="number"
                    value={editInvoiceState.paidAmount ?? ""}
                    onChange={(e) => setEditInvoiceState({ ...editInvoiceState, paidAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 1500"
                  />
                  {editInvoiceState.paidAmount != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {formatCurrency(Math.max(0, editInvoiceState.amount - editInvoiceState.paidAmount))}
                    </p>
                  )}
                </div>
              )}
              <Button className="w-full" onClick={handleEditSave} accessAction="edit">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteInvoiceState} onOpenChange={() => setDeleteInvoiceState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Invoice</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete invoice <strong>{deleteInvoiceState?.invoiceNo}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteInvoiceState(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} accessAction="delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Invoices Warning Dialog */}
      <Dialog open={clearInvoicesOpen} onOpenChange={setClearInvoicesOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Clear all invoices?</DialogTitle>
            <DialogDescription>
              This will permanently delete every invoice currently in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            You are about to delete{" "}
            <span className="font-semibold">{invoices.length}</span> invoice
            {invoices.length === 1 ? "" : "s"}. Linked bookings may also be removed.
            This action cannot be undone.
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setClearInvoicesOpen(false)}
              disabled={isClearingInvoices}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllInvoices}
              disabled={isClearingInvoices || invoices.length === 0}
            >
              {isClearingInvoices ? "Clearing?" : "Yes, clear all invoices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Billing — compact offline invoice */}
      <Dialog
        open={isAddBillingOpen}
        onOpenChange={(open) => {
          if (!open) resetOfflineForm()
          setIsAddBillingOpen(open)
        }}
      >
        <DialogContent className="flex max-h-[min(88dvh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]">
          <DialogHeader className="shrink-0 space-y-0.5 border-b border-[#eee] px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-[16px]">
              <Receipt className="h-4 w-4 text-brand-primary" />
              Add Billing
            </DialogTitle>
            <DialogDescription className="text-xs">
              Offline invoice · <span className="text-destructive">*</span> required
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  Source <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={invoiceSource}
                  onValueChange={(v: "online" | "offline") => setInvoiceSource(v)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const maxDate = new Date(today)
                maxDate.setDate(today.getDate() + 60)
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Date <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={offlineDateOpen} onOpenChange={setOfflineDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-full justify-start px-2.5 text-xs font-normal"
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                          {format(offlineDate, "dd MMM yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                        <DateCalendar
                          mode="single"
                          selected={offlineDate}
                          onSelect={(d) => {
                            if (d) {
                              setOfflineDate(d)
                              setOfflineDateOpen(false)
                            }
                          }}
                          disabled={(d) => {
                            const day = new Date(d)
                            day.setHours(0, 0, 0, 0)
                            return day < today || day > maxDate
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )
              })()}
            </div>

            {(() => {
              const digits = offlineClientPhone.replace(/\D/g, "")
              const isTouched = offlineClientPhone.length > 0
              const wrongPrefix = isTouched && !offlineClientPhone.startsWith("01")
              const wrongLength = isTouched && !wrongPrefix && digits.length !== 11
              const isInvalid = wrongPrefix || wrongLength
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Phone <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. 01712345678"
                        value={offlineClientPhone}
                        maxLength={11}
                        onChange={(e) => {
                          setOfflineClientPhone(e.target.value)
                          setOfflineClientId(null)
                          setClientLookupStatus("idle")
                          setOfflineClientName("")
                        }}
                        className={cn(
                          "h-9 pr-8 text-sm",
                          isInvalid && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {isPhoneLookingUp && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {isInvalid && (
                      <p className="text-[10px] font-medium text-destructive">
                        {wrongPrefix ? "Must start with 01" : `${digits.length}/11 digits`}
                      </p>
                    )}
                    {!isInvalid && clientLookupStatus === "found" && (
                      <p className="text-[10px] font-medium text-green-600">Existing client</p>
                    )}
                    {!isInvalid && clientLookupStatus === "new" && (
                      <p className="text-[10px] font-medium text-brand-primary">New client</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Client <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Alex Rahman"
                      value={offlineClientName}
                      onChange={(e) => setOfflineClientName(e.target.value)}
                      readOnly={clientLookupStatus === "found"}
                      className={cn(
                        "h-9 text-sm",
                        clientLookupStatus === "found" &&
                          "cursor-not-allowed bg-muted/50 text-muted-foreground",
                      )}
                    />
                  </div>
                </div>
              )
            })()}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">
                  Items <span className="text-destructive">*</span>
                </Label>
                {(offlineServices.length > 0 || offlinePackages.length > 0) && (
                  <button
                    type="button"
                    className="text-[10px] text-destructive hover:underline"
                    onClick={() => {
                      setOfflineServices([])
                      setOfflinePackages([])
                      setOfflineAmount("")
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 rounded-md border border-[#e7e7e7] bg-brand-mist p-0.5">
                <button
                  type="button"
                  onClick={() => setOfflineCatalogTab("services")}
                  className={cn(
                    "rounded-[5px] px-2 py-1.5 text-xs font-medium transition-colors",
                    offlineCatalogTab === "services"
                      ? "bg-white text-brand-primary shadow-sm"
                      : "text-[#666] hover:text-[#333]",
                  )}
                >
                  Services{offlineServices.length > 0 ? ` (${offlineServices.length})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setOfflineCatalogTab("packages")}
                  className={cn(
                    "rounded-[5px] px-2 py-1.5 text-xs font-medium transition-colors",
                    offlineCatalogTab === "packages"
                      ? "bg-white text-brand-primary shadow-sm"
                      : "text-[#666] hover:text-[#333]",
                  )}
                >
                  Packages{offlinePackages.length > 0 ? ` (${offlinePackages.length})` : ""}
                </button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs hover:bg-[#f8fafc]"
                  >
                    <span className="truncate text-muted-foreground">
                      {offlineCatalogTab === "services"
                        ? serviceOptions.length === 0
                          ? "Loading services…"
                          : "Add service…"
                        : packageOptions.length === 0
                          ? "No packages"
                          : "Add package…"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={4}
                  collisionPadding={12}
                  className="z-[80] w-[var(--radix-popover-trigger-width)] p-0"
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <div className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
                  {offlineCatalogTab === "services" ? (
                    serviceOptions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">No active services</p>
                    ) : (
                      serviceOptions.map((s) => {
                        const qty = offlineServices.filter((n) => n === s.name).length
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent/50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatCurrency(s.price)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                disabled={qty === 0}
                                className="flex h-6 w-6 items-center justify-center rounded border text-sm font-bold disabled:opacity-25"
                                onClick={() => {
                                  const idx = offlineServices.lastIndexOf(s.name)
                                  if (idx !== -1) handleRemoveService(idx)
                                }}
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-xs font-semibold tabular-nums">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded border text-sm font-bold"
                                onClick={() => handleAddService(s.name)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )
                  ) : packageOptions.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No packages</p>
                  ) : (
                    packageOptions.map((p) => {
                      const qty = offlinePackages.filter((n) => n === p.name).length
                      return (
                        <div
                          key={p.name}
                          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatCurrency(p.price)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={qty === 0}
                              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-bold disabled:opacity-25"
                              onClick={() => {
                                const idx = offlinePackages.lastIndexOf(p.name)
                                if (idx !== -1) handleRemovePackage(idx)
                              }}
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-xs font-semibold tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded border text-sm font-bold"
                              onClick={() => handleAddPackage(p.name)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="overflow-hidden rounded-md border border-[#e8e8e8]">
                <div className="max-h-36 overflow-y-auto">
                  <Table cursorPagination={cursorTable}>
                    <TableHeader>
                      <TableRow className="hover:bg-[#f7f8fa]">
                        <TableHead className="h-7 bg-[#f7f8fa] text-[10px] font-semibold">Item</TableHead>
                        <TableHead className="h-7 w-10 bg-[#f7f8fa] text-center text-[10px] font-semibold">
                          Qty
                        </TableHead>
                        <TableHead className="h-7 w-20 bg-[#f7f8fa] text-right text-[10px] font-semibold">
                          Total
                        </TableHead>
                        <TableHead className="h-7 w-7 bg-[#f7f8fa]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offlineServices.length === 0 && offlinePackages.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-4 text-center text-xs text-muted-foreground"
                          >
                            Add a service or package
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {(() => {
                            const counts = new Map<string, number>()
                            for (const name of offlineServices) {
                              counts.set(name, (counts.get(name) ?? 0) + 1)
                            }
                            return Array.from(counts.entries()).map(([name, qty]) => {
                              const unit = Number(
                                serviceOptions.find((o) => o.name === name)?.price || 0,
                              )
                              return (
                                <TableRow key={`svc-${name}`}>
                                  <TableCell className="py-1.5 text-[11px] font-medium">
                                    <span className="mr-1 rounded bg-brand-soft px-1 py-0.5 text-[9px] font-semibold uppercase text-brand-primary">
                                      Svc
                                    </span>
                                    {name}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-center text-[11px] tabular-nums">
                                    {qty}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right text-[11px] tabular-nums">
                                    {formatCurrency(unit * qty)}
                                  </TableCell>
                                  <TableCell className="py-1.5 pr-1 text-right">
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-muted-foreground hover:text-rose-600"
                                      onClick={() => {
                                        const idx = offlineServices.lastIndexOf(name)
                                        if (idx !== -1) handleRemoveService(idx)
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          })()}
                          {(() => {
                            const counts = new Map<string, number>()
                            for (const name of offlinePackages) {
                              counts.set(name, (counts.get(name) ?? 0) + 1)
                            }
                            return Array.from(counts.entries()).map(([name, qty]) => {
                              const unit = Number(
                                packageOptions.find((o) => o.name === name)?.price || 0,
                              )
                              return (
                                <TableRow key={`pkg-${name}`}>
                                  <TableCell className="py-1.5 text-[11px] font-medium">
                                    <span className="mr-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                                      Pkg
                                    </span>
                                    {name}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-center text-[11px] tabular-nums">
                                    {qty}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right text-[11px] tabular-nums">
                                    {formatCurrency(unit * qty)}
                                  </TableCell>
                                  <TableCell className="py-1.5 pr-1 text-right">
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-muted-foreground hover:text-rose-600"
                                      onClick={() => {
                                        const idx = offlinePackages.lastIndexOf(name)
                                        if (idx !== -1) handleRemovePackage(idx)
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          })()}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-1.5 border-t border-[#e8e8e8] bg-[#fafafa] px-2.5 py-2">
                  {(() => {
                    const { subtotal, taxAmount, total } = computeOfflinePayable(
                      parseFloat(offlineAmount) || 0,
                      offlineTaxRate,
                    )
                    return (
                      <>
                        <div className="flex items-center justify-between text-[11px] text-[#666]">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#666]">
                          <Label htmlFor="offline-tax-rate" className="shrink-0 text-[11px] font-normal text-[#666]">
                            VAT (%)
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input placeholder="e.g. 10"
                              id="offline-tax-rate"
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={offlineTaxRate}
                              onChange={(e) => {
                                const next = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                setOfflineTaxRate(next)
                              }}
                              className="h-7 w-[72px] text-right text-[11px] tabular-nums"
                            />
                            <span className="w-[72px] text-right text-[11px] tabular-nums">
                              {formatCurrency(taxAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#e8e8e8] pt-1.5">
                          <span className="text-[11px] font-medium text-[#666]">Total</span>
                          <span className="text-sm font-semibold tabular-nums text-brand-primary">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>

            {(() => {
              const { total: totalAmt } = computeOfflinePayable(
                parseFloat(offlineAmount) || 0,
                offlineTaxRate,
              )
              const rawPaid = Number.parseFloat(offlinePaidAmount)
              const paidAmt =
                offlinePaidAmount.trim() === "" || !Number.isFinite(rawPaid)
                  ? 0
                  : Math.min(totalAmt, Math.max(0, rawPaid))
              const dueAmt = Math.max(0, totalAmt - paidAmt)
              const offlineStatus = resolveBackendInvoiceStatus(totalAmt, paidAmt)
              const statusLabel =
                offlineStatus === "Due" ? "Unpaid" : offlineStatus
              const statusClass =
                offlineStatus === "Paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : offlineStatus === "Partial"
                    ? "bg-brand-soft text-brand-deep border-brand-line"
                    : "bg-amber-50 text-amber-700 border-amber-200"

              const clampPaidInput = (raw: string) => {
                if (raw === "") {
                  setOfflinePaidAmount("")
                  return
                }
                const cleaned = raw.replace(/[^\d.]/g, "")
                const parts = cleaned.split(".")
                const normalized =
                  parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned
                const value = Number.parseFloat(normalized)
                if (Number.isFinite(value) && totalAmt > 0 && value > totalAmt) {
                  setOfflinePaidAmount(
                    Number.isInteger(totalAmt) ? String(totalAmt) : totalAmt.toFixed(2),
                  )
                  return
                }
                setOfflinePaidAmount(normalized)
              }

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Method <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={offlinePaymentMethod}
                        onValueChange={(v) =>
                          setOfflinePaymentMethod(v as "Cash" | "bKash" | "Nagad" | "Bank" | "Card")
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="bKash">bKash</SelectItem>
                          <SelectItem value="Nagad">Nagad</SelectItem>
                          <SelectItem value="Bank">Bank</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Artist
                        {offlineStatus === "Paid" && (
                          <span className="ml-0.5 text-destructive">*</span>
                        )}
                      </Label>
                      <Select value={offlineStaff} onValueChange={setOfflineStaff}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {stylists.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="offline-amount-received">
                      Amount received (৳)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="offline-amount-received"
                        type="number"
                        min={0}
                        max={totalAmt || undefined}
                        step="1"
                        placeholder="e.g. 1500"
                        value={offlinePaidAmount}
                        onChange={(e) => clampPaidInput(e.target.value)}
                        className="h-9 flex-1"
                        disabled={totalAmt <= 0}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0"
                        disabled={totalAmt <= 0}
                        onClick={() =>
                          setOfflinePaidAmount(
                            Number.isInteger(totalAmt)
                              ? String(totalAmt)
                              : totalAmt.toFixed(2),
                          )
                        }
                      >
                        Full
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-md border border-[#e8e8e8] bg-[#fafafa] px-2.5 py-2">
                    <div className="space-y-0.5 text-[11px] text-[#666]">
                      <div className="flex gap-3 tabular-nums">
                        <span>Total {formatCurrency(totalAmt)}</span>
                        <span className={dueAmt > 0 ? "text-rose-600" : "text-emerald-700"}>
                          Due {formatCurrency(dueAmt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Empty / 0 → unpaid · Full → paid
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        statusClass,
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {offlineStatus === "Paid" &&
                    offlineStaff.trim() &&
                    offlineServices.length > 0 &&
                    (() => {
                      const totalCommission = offlineServices.reduce((sum, name) => {
                        const svc = serviceOptions.find((o) => o.name === name)
                        if (!svc || svc.commission <= 0) return sum
                        return sum + (svc.price * svc.commission) / 100
                      }, 0)
                      if (totalCommission <= 0) return null
                      return (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-[#e7e7e7] px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              Commission · {formatCurrency(totalCommission)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Add to payroll bonus</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setApplyCommission(!applyCommission)}
                            className={cn(
                              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                              applyCommission ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                            role="switch"
                            aria-checked={applyCommission}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
                                applyCommission ? "translate-x-4" : "translate-x-0",
                              )}
                            />
                          </button>
                        </div>
                      )
                    })()}
                </div>
              )
            })()}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-[#eee] px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetOfflineForm()
                setIsAddBillingOpen(false)
              }}
              disabled={isAddBillingSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddBillingSubmit}
              disabled={(() => {
                const { total: totalAmt } = computeOfflinePayable(
                  parseFloat(offlineAmount) || 0,
                  offlineTaxRate,
                )
                const rawPaid = Number.parseFloat(offlinePaidAmount)
                const paidAmt =
                  offlinePaidAmount.trim() === "" || !Number.isFinite(rawPaid)
                    ? 0
                    : Math.min(totalAmt, Math.max(0, rawPaid))
                const status = resolveBackendInvoiceStatus(totalAmt, paidAmt)
                return (
                  isAddBillingSubmitting ||
                  isPhoneLookingUp ||
                  offlineClientPhone.replace(/\D/g, "").length !== 11 ||
                  !offlineClientPhone.startsWith("01") ||
                  !offlineClientName.trim() ||
                  (offlineServices.length === 0 && offlinePackages.length === 0) ||
                  totalAmt <= 0 ||
                  (status === "Paid" && !offlineStaff.trim())
                )
              })()}
             accessAction="create">
              {isAddBillingSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
