"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { getClients, createClient, updateClient, deleteClient } from "@admin/api/clients/clients"
import { useState, useMemo, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { useDebounce } from "@/hooks/use-debounce"
import { useRouter } from "next/navigation"
import { toast } from '@/lib/toast'
import { AdminPageHeader, AdminHeaderPrimaryButton, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header"
import { ClientKpiCards } from "@admin/components/client-kpi-cards"
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
import { Plus, Search, Download, Pencil, Trash2, Calendar, Calendar as CalendarIcon, Loader2, User } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, formatMoney } from "@/lib/utils"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string
  /** Invoice count (Bookings column) */
  bookings?: number
  /** @deprecated alias of bookings */
  visits: number
  onlineBookings?: number
  offlineBookings?: number
  totalSpent: number
  totalPaid?: number
  dueAmount?: number
  firstVisit: string | null
  lastVisit: string | null
  appointments?: Array<{
    services?: string[] | null
    source?: string | null
  }>
  invoices?: Array<{
    total?: number | string | null
    paidAmount?: number | string | null
    status?: string | null
    source?: string | null
    createdAt?: string | null
    confirmedAt?: string | null
    appointmentId?: string | null
    appointment?: { id?: string } | null
  }>
}


const TIME_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Date" },
]

const PAGE_SIZE = 10
const HEAD_CLASS =
  "h-11 px-3 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]"
const CELL_CLASS = "px-3 py-3 text-left text-[13px] text-[#333]"
const FILTER_TRIGGER =
  "h-[38px] w-[150px] rounded-lg border border-[#e7e7e7] bg-white px-3 text-sm font-medium text-[#333] shadow-none focus:ring-2 focus:ring-brand-primary/20 focus:ring-offset-0 hover:border-[#cfd8e3] [&>svg]:text-[#666]"

const normalizePhone = (value: string) => value.replace(/\D/g, "")

const formatLastVisit = (value: string | null | undefined) => {
  if (!value) return "—"
  try {
    const raw = String(value).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return format(new Date(`${raw}T00:00:00`), "dd MMM yyyy")
    }
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return "—"
    return format(d, "dd MMM yyyy")
  } catch {
    return "—"
  }
}

const getTotalPaid = (client: Client) => {
  if (client.totalPaid != null && Number.isFinite(Number(client.totalPaid))) {
    return Math.max(0, Number(client.totalPaid) || 0)
  }
  return (client.invoices ?? []).reduce((sum, invoice) => {
    return sum + Math.max(0, Number(invoice.paidAmount) || 0)
  }, 0)
}

const getInvoiceBookingCount = (client: Client) =>
  client.bookings ?? client.visits ?? client.invoices?.length ?? 0

const getInvoiceSourceBreakdown = (client: Client) => {
  if (
    client.onlineBookings != null &&
    client.offlineBookings != null &&
    Number.isFinite(client.onlineBookings) &&
    Number.isFinite(client.offlineBookings)
  ) {
    return {
      online: Math.max(0, Number(client.onlineBookings) || 0),
      offline: Math.max(0, Number(client.offlineBookings) || 0),
    }
  }
  let online = 0
  let offline = 0
  for (const inv of client.invoices ?? []) {
    const hasAppointment = Boolean(inv.appointmentId || inv.appointment?.id)
    const sourceRaw = String(inv.source || "").toLowerCase()
    if (hasAppointment || sourceRaw.includes("online")) online += 1
    else offline += 1
  }
  return { online, offline }
}

const getDueAmount = (client: Client) => {
  if (client.dueAmount != null && Number.isFinite(Number(client.dueAmount))) {
    return Math.max(0, Number(client.dueAmount) || 0)
  }
  return (client.invoices ?? []).reduce((sum, invoice) => {
    if ((invoice.status ?? "").toLowerCase() === "paid") return sum
    const total = Number(invoice.total) || 0
    const paid = Number(invoice.paidAmount) || 0
    return sum + Math.max(0, total - paid)
  }, 0)
}

// Bangladeshi phone validation: 01[3-9]XXXXXXXX or +8801[3-9]XXXXXXXX
const isValidPhone = (phone: string) => {
  const normalized = normalizePhone(phone)
  return /^(?:88)?01[3-9]\d{8}$/.test(normalized)
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [timeFilter, setTimeFilter] = useState("all")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [clientFromOpen, setClientFromOpen] = useState(false)
  const [clientToOpen, setClientToOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
  })
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [clientErrors, setClientErrors] = useState<{ name?: string; phone?: string; email?: string }>({})
  const [clientTouched, setClientTouched] = useState(false)

  const fetchClients = useCallback(async (noCache = false) => {
    try {
      const res = await getClients(1, 1000, noCache)
      const list = res?.data ?? res
      setClients(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error(err)
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients(true)
  }, [fetchClients])

  // Edit/Delete dialogs
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteClientState, setDeleteClientState] = useState<Client | null>(null)

  const filterByDate = (date: string | null | undefined) => {
    if (timeFilter === "all") return true
    if (!date) return false
    if (timeFilter === "custom") {
      if (!customDateFrom && !customDateTo) return true
      const d = new Date(date)
      if (customDateFrom && d < new Date(customDateFrom)) return false
      if (customDateTo && d > new Date(customDateTo)) return false
      return true
    }
    const now = new Date()
    const itemDate = new Date(date)
    switch (timeFilter) {
      case "today":
        return itemDate.toDateString() === now.toDateString()
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return itemDate >= weekAgo
      case "month":
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()
      case "6months":
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        return itemDate >= sixMonthsAgo
      case "year":
        return itemDate.getFullYear() === now.getFullYear()
      default:
        return true
    }
  }

  const filteredClients = useMemo(() => {
    const searchTerm = debouncedSearch.trim().toLowerCase()
    const normalizedSearch = normalizePhone(debouncedSearch)

    let result = clients.filter(
      (client) => {
        if (!searchTerm) {
          return filterByDate(client.lastVisit)
        }

        const nameMatch = (client.name ?? "").toLowerCase().includes(searchTerm)
        const phoneMatch =
          normalizedSearch.length > 0 &&
          normalizePhone(client.phone ?? "").includes(normalizedSearch)

        return (nameMatch || phoneMatch) && filterByDate(client.lastVisit)
      }
    )

    // Primary sort: most bookings (invoices) first. Tie-breaker: latest visit first.
    result = [...result].sort((a, b) => {
      const aBookings = getInvoiceBookingCount(a)
      const bBookings = getInvoiceBookingCount(b)
      if (bBookings !== aBookings) {
        return bBookings - aBookings
      }

      const aLastVisit = new Date(a.lastVisit ?? "").getTime()
      const bLastVisit = new Date(b.lastVisit ?? "").getTime()
      const safeALastVisit = Number.isNaN(aLastVisit) ? 0 : aLastVisit
      const safeBLastVisit = Number.isNaN(bLastVisit) ? 0 : bLastVisit
      return safeBLastVisit - safeALastVisit
    })

    return result
  }, [clients, debouncedSearch, timeFilter, customDateFrom, customDateTo])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, timeFilter, customDateFrom, customDateTo])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredClients, row => String(row.id))
  const paginatedClients = cursorTable.data

  const validateNewClient = (data: typeof newClient) => {
    const errors: { name?: string; phone?: string; email?: string } = {}
    if (!data.name.trim()) {
      errors.name = "Full name is required"
    }
    if (!data.phone.trim()) {
      errors.phone = "Phone number is required"
    } else if (!isValidPhone(data.phone)) {
      errors.phone = "Please enter a valid Bangladeshi Phone Number"
    }
    if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errors.email = "Enter a valid email address"
    }
    return errors
  }

  const handleAddClient = async () => {
    setClientTouched(true)
    const errors = validateNewClient(newClient)
    setClientErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      setIsAdding(true)
      const payload = {
        name: newClient.name.trim(),
        phone: normalizePhone(newClient.phone),
        email: newClient.email.trim() || undefined,
      }
      await createClient(payload)
      const res = await getClients(1, 1000)
      setClients(res.data ?? res)
      setIsDialogOpen(false)
      setNewClient({ name: "", email: "", phone: "" })
      setClientErrors({})
      setClientTouched(false)
      toast.success("Client created successfully")
    } catch (error: any) {
      console.error("Error creating client:", error)
      const msg = error?.response?.data?.message
      const finalMsg = Array.isArray(msg) ? msg[0] : msg || error.message || "Failed to create client"
      toast.error(finalMsg)
    } finally {
      setIsAdding(false)
    }
  }

  const handleEditSave = async () => {
    if (!editClient) return

    // Validate name and phone
    if (!editClient.name.trim()) {
      toast.error("Client name is required")
      return
    }

    if (!isValidPhone(editClient.phone)) {
      toast.error("Please enter a valid Bangladeshi Phone Number")
      return
    }

    try {
      setIsSaving(true)
      // Send only the necessary fields to the server (not computed fields like visits, totalSpent)
      await updateClient(editClient.id, {
        name: editClient.name.trim(),
        phone: normalizePhone(editClient.phone),
        email: editClient.email?.trim() || null,
      })

      // Refresh the client list to show updated data
      const res = await getClients(1, 1000)
      setClients(res.data ?? res)
      setEditClient(null)

      toast.success("Client updated successfully. Changes will reflect across all pages.")
    } catch (error: any) {
      console.error("Error updating client:", error)
      const msg = error?.response?.data?.message
      const finalMsg = Array.isArray(msg) ? msg[0] : msg || error.message || "Failed to update client"
      toast.error(finalMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteClientState) return
    try {
      setIsDeleting(true)
      await deleteClient(deleteClientState.id)
      setClients(clients.filter(c => c.id !== deleteClientState.id))
      setDeleteClientState(null)
      toast.success("Client deleted successfully")
    } catch (error: any) {
      console.error("Error deleting client:", error)
      const msg = error?.response?.data?.message
      const finalMsg = Array.isArray(msg) ? msg[0] : msg || error.message || "Failed to delete client"
      toast.error(finalMsg)
    } finally {
      setIsDeleting(false)
    }
  }


  const handleExportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Bookings",
      "Online",
      "Offline",
      "Paid",
      "Total Spent",
      "Due",
      "Last Visit",
    ]
    const rows = filteredClients.map((c) => {
      const sources = getInvoiceSourceBreakdown(c)
      return [
        c.name,
        c.email,
        c.phone,
        getInvoiceBookingCount(c),
        sources.online,
        sources.offline,
        getTotalPaid(c),
        c.totalSpent,
        getDueAmount(c),
        c.lastVisit,
      ]
    })
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "clients.csv"
    a.click()
  }



  return (
    <>
      <div className={DASH_PAGE}>
        <AdminPageHeader
          title="Clients Details"
          subtitle="Browse and manage your salon client records"
          actions={
            <>
            <AdminHeaderSecondaryButton onClick={handleExportCSV} accessAction="export">
              <Download />
              Export CSV
            </AdminHeaderSecondaryButton>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                setNewClient({ name: "", email: "", phone: "" })
                setClientErrors({})
                setClientTouched(false)
              }
            }}>
              <DialogTrigger asChild>
                <AdminHeaderPrimaryButton accessAction="create">
                  <Plus />
                  Add Client
                </AdminHeaderPrimaryButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                </DialogHeader>
                <div className="mt-2 space-y-5 pb-6">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newClient.name}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewClient({ ...newClient, name: val })
                        if (clientTouched) {
                          setClientErrors((prev) => ({
                            ...prev,
                            name: val.trim() ? undefined : "Full name is required",
                          }))
                        }
                      }}
                      placeholder="e.g. Alex Rahman"
                      className={clientErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {clientErrors.name && (
                      <p className="text-[12px] text-destructive flex items-center gap-1">
                        <span>⚠</span> {clientErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">
                      Email <span className="text-muted-foreground text-[11px] font-normal">(optional)</span>
                    </Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewClient({ ...newClient, email: val })
                        if (clientTouched) {
                          const emailError = val.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
                            ? "Enter a valid email address"
                            : undefined
                          setClientErrors((prev) => ({ ...prev, email: emailError }))
                        }
                      }}
                      placeholder="e.g. alex@example.com"
                      className={clientErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {clientErrors.email && (
                      <p className="text-[12px] text-destructive flex items-center gap-1">
                        <span>⚠</span> {clientErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold tracking-wide">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newClient.phone}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewClient({ ...newClient, phone: val })
                        let phoneError: string | undefined
                        if (val.trim() && !isValidPhone(val)) phoneError = "Must be in format: 01712345678 or +8801712345678"
                        setClientErrors((prev) => ({ ...prev, phone: phoneError }))
                      }}
                      placeholder="e.g. 01712345678"
                      className={clientErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {clientErrors.phone && (
                      <p className="text-[12px] text-destructive flex items-center gap-1">
                        <span>⚠</span> {clientErrors.phone}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleAddClient} disabled={isAdding} className="mt-1 h-10 w-full" accessAction="create">
                    {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isAdding ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </>
          }
        />

        <ClientKpiCards clients={filteredClients} loading={loading} className="mb-5" />

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                <Input
                  placeholder="Search by client or phone number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-[38px] rounded-lg border-[#e7e7e7] bg-white pl-9 text-sm shadow-none focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                />
              </div>

              <Popover open={showCustomDate && timeFilter === "custom"} onOpenChange={(open) => setShowCustomDate(open)}>
                <PopoverTrigger asChild>
                  <div>
                    <Select
                      value={timeFilter}
                      onValueChange={(v) => {
                        setTimeFilter(v)
                        if (v === "custom") setShowCustomDate(true)
                      }}
                    >
                      <SelectTrigger className={FILTER_TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                        {TIME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-xl border border-[#e7e7e7] p-4 shadow-xl">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Popover open={clientFromOpen} onOpenChange={setClientFromOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="mt-1 w-full justify-start px-3 font-normal" accessAction="create">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className={customDateFrom ? "text-foreground" : "text-muted-foreground"}>
                              {customDateFrom ? format(new Date(`${customDateFrom}T00:00:00`), "PPP") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                          <DateCalendar
                            mode="single"
                            selected={customDateFrom ? new Date(`${customDateFrom}T00:00:00`) : undefined}
                            onSelect={(selected) => {
                              if (!selected) return
                              setCustomDateFrom(format(selected, "yyyy-MM-dd"))
                              setClientFromOpen(false)
                            }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Popover open={clientToOpen} onOpenChange={setClientToOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="mt-1 w-full justify-start px-3 font-normal" accessAction="create">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className={customDateTo ? "text-foreground" : "text-muted-foreground"}>
                              {customDateTo ? format(new Date(`${customDateTo}T00:00:00`), "PPP") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                          <DateCalendar
                            mode="single"
                            selected={customDateTo ? new Date(`${customDateTo}T00:00:00`) : undefined}
                            onSelect={(selected) => {
                              if (!selected) return
                              setCustomDateTo(format(selected, "yyyy-MM-dd"))
                              setClientToOpen(false)
                            }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => setShowCustomDate(false)}>
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <span className="text-sm text-[#666] whitespace-nowrap">
                {loading ? "Loading..." : `${filteredClients.length} results`}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
              <Table cursorPagination={cursorTable} className="table-fixed min-w-[1180px]">
                <colgroup>
                  <col className="w-[60px]" />
                  <col className="w-[180px]" />
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                  <col className="w-[110px]" />
                  <col className="w-[110px]" />
                  <col className="w-[120px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-[#f2f2f2] hover:bg-transparent">
                    <TableHead className={HEAD_CLASS}>SL.</TableHead>
                    <TableHead className={HEAD_CLASS}>Client</TableHead>
                    <TableHead className={HEAD_CLASS}>Contact</TableHead>
                    <TableHead className={HEAD_CLASS}>Bookings</TableHead>
                    <TableHead className={HEAD_CLASS}>Source</TableHead>
                    <TableHead className={HEAD_CLASS}>Paid</TableHead>
                    <TableHead className={HEAD_CLASS}>Total Spent</TableHead>
                    <TableHead className={HEAD_CLASS}>Due</TableHead>
                    <TableHead className={HEAD_CLASS}>Last Visit</TableHead>
                    <TableHead className={HEAD_CLASS}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="px-4 py-10 text-sm text-muted-foreground">
                        Loading clients...
                      </TableCell>
                    </TableRow>
                  ) : paginatedClients.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="px-4 py-10 text-sm text-muted-foreground">
                        No clients found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedClients.map((client, index) => {
                      const bookingCount = getInvoiceBookingCount(client)
                      const sources = getInvoiceSourceBreakdown(client)
                      const paidTotal = getTotalPaid(client)
                      const dueAmount = getDueAmount(client)
                      return (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer border-b border-[#f2f2f2] transition-colors hover:bg-[#f0f7ff]"
                          onClick={() => router.push(`/admin/clients/${client.id}`)}
                        >
                          <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                            {cursorTable.pageInfo.from + index}
                          </TableCell>
                          <TableCell className={CELL_CLASS}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar className="size-9 shrink-0">
                                <AvatarFallback className="bg-brand-soft text-brand-primary">
                                  <User className="size-4" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate font-medium" title={client.name}>
                                {client.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={CELL_CLASS}>
                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate" title={client.phone}>
                                {client.phone}
                              </p>
                              {client.email && (
                                <p className="truncate text-[12px] text-[#888]" title={client.email}>
                                  {client.email}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={cn(CELL_CLASS, "tabular-nums font-medium")}>
                            {bookingCount}
                          </TableCell>
                          <TableCell className={CELL_CLASS}>
                            {sources.online === 0 && sources.offline === 0 ? (
                              <span className="text-[#888]">—</span>
                            ) : (
                              <div className="space-y-0.5 text-[12px] leading-tight text-[#555]">
                                <p>{sources.online} Online</p>
                                <p>{sources.offline} Offline</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums text-emerald-700")}>
                            {formatMoney(paidTotal)}
                          </TableCell>
                          <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>
                            {formatMoney(client.totalSpent ?? 0)}
                          </TableCell>
                          <TableCell className={cn(CELL_CLASS, "tabular-nums")}>
                            {dueAmount > 0 ? (
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                {formatMoney(dueAmount)}
                              </span>
                            ) : (
                              <span className="text-[#888]">—</span>
                            )}
                          </TableCell>
                          <TableCell className={CELL_CLASS}>
                            {formatLastVisit(client.lastVisit)}
                          </TableCell>
                          <TableCell
                            className={CELL_CLASS}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg bg-[#ecfdf5] text-[#059669] hover:bg-[#059669] hover:text-white"
                                aria-label="Edit client"
                                onClick={() =>
                                  setEditClient({
                                    ...client,
                                    name: client.name ?? "",
                                    email: client.email ?? "",
                                    phone: client.phone ?? "",
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg bg-[#fff1f2] text-[#e11d48] hover:bg-[#e11d48] hover:text-white"
                                aria-label="Delete client"
                                onClick={() => setDeleteClientState(client)}
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

          {!loading && filteredClients.length > 0 && (
            <></>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editClient && (
            <div className="mt-2 space-y-5 pb-24">
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold tracking-wide">Full Name</Label>
                <Input value={editClient.name ?? ""} onChange={(e) => setEditClient({ ...editClient, name: e.target.value })} placeholder="e.g. Alex Rahman" />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold tracking-wide">Email</Label>
                <Input type="email" value={editClient.email ?? ""} onChange={(e) => setEditClient({ ...editClient, email: e.target.value })} placeholder="e.g. alex@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold tracking-wide">Phone Number</Label>
                <Input
                  value={editClient.phone ?? ""}
                  onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                  placeholder="01712345678 or +8801712345678"
                />
                {editClient.phone && !isValidPhone(editClient.phone) && (
                  <p className="text-[12px] text-destructive mt-1 flex items-center gap-1">
                    <span>⚠</span> Please enter a valid Bangladeshi Phone Number
                  </p>
                )}
              </div>
              <Button className="mt-1 h-10 w-full" onClick={handleEditSave} disabled={isSaving} accessAction="edit">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? "Saving Changes..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteClientState} onOpenChange={() => setDeleteClientState(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-muted-foreground leading-relaxed">Are you sure you want to delete <strong>{deleteClientState?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClientState(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} accessAction="delete">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
