"use client"
import { getCursorCollection } from "@/lib/pagination/collection"
import { Table } from "@/components/ui/table"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AccountShell, accountStyles as styles } from "@/components/account-shell"
import { CustomerPageHeader } from "@/components/customer-page-header"
import { DEFAULT_BUSINESS_NAME, resolveBusinessName } from "@/lib/business-branding"
import api from "@admin/api/base"
import { CalendarDays, CheckCircle2, Clock3, Download, Wallet } from "lucide-react"

interface Booking {
    id: string
    date: string
    time: string
    appointmentStatus: string
    services: string[]
    invoiceId: string | null
    invoiceNumber: string | null
    staff: string | null
    total: number | null
    paymentMethod: string | null
    invoiceStatus: string | null
    invoicedAt: string | null
}

interface DashboardData {
    name: string
    email: string
    phone: string
    bookings: Booking[]
}

function formatDate(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    } catch { return dateStr }
}

function formatTime(timeStr: string) {
    try {
        const [h, m] = timeStr.split(":")
        const hour = parseInt(h)
        return `${hour % 12 || 12}:${m} ${hour < 12 ? "AM" : "PM"}`
    } catch { return timeStr }
}

async function downloadInvoicePDF(booking: Booking, customerName: string, businessName: string) {
    const { default: jsPDF } = await import("jspdf/dist/jspdf.es.min.js")
    const { default: autoTable } = await (import("jspdf-autotable") as any)

    const doc = new (jsPDF as any)()

    // Header
    doc.setFontSize(18)
    doc.setTextColor(20)
    doc.text(businessName, 105, 18, { align: "center" })

    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text("CUSTOMER COPY", 105, 25, { align: "center" })

    // Divider
    doc.setDrawColor(220)
    doc.line(14, 29, 196, 29)

    // Invoice meta
    doc.setFontSize(9)
    doc.setTextColor(80)
    doc.text(`Invoice No: ${booking.invoiceNumber ?? "N/A"}`, 14, 36)
    doc.text(`Date: ${booking.date ? formatDate(booking.date) : "—"}  Time: ${booking.time ? formatTime(booking.time) : "—"}`, 14, 42)
    doc.text(`Customer: ${customerName}`, 14, 48)

    doc.setFontSize(9)
    doc.setTextColor(40)

    // Services table
    const serviceRows = (booking.services ?? []).map((s: string) => [s])
    autoTable(doc, {
        startY: 55,
        head: [["Services"]],
        body: serviceRows.length ? serviceRows : [["—"]],
        theme: "striped",
        headStyles: { fillColor: [112, 64, 193], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: 50 },
        columnStyles: { 0: { cellWidth: "auto" } },
    })

    const afterServices = (doc as any).lastAutoTable.finalY + 8

    // Summary table
    const summary: string[][] = []
    if (booking.staff) summary.push(["Artist", booking.staff])
    summary.push(["Payment Method", booking.paymentMethod ?? "—"])
    summary.push(["Payment Status", booking.invoiceStatus ?? "—"])
    summary.push(["Total", `BDT ${Number(booking.total ?? 0).toFixed(2)}`])

    autoTable(doc, {
        startY: afterServices,
        body: summary,
        theme: "plain",
        bodyStyles: { fontSize: 9, textColor: 50 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 1: { halign: "right" } },
    })

    const afterSummary = (doc as any).lastAutoTable.finalY + 8
    doc.setDrawColor(220)
    doc.line(14, afterSummary, 196, afterSummary)

    doc.setFontSize(8)
    doc.setTextColor(160)
    doc.text("Thank you for choosing us. This is a computer-generated receipt.", 105, afterSummary + 7, { align: "center" })

    doc.save(`Invoice_${booking.invoiceNumber ?? booking.id.slice(0, 8)}.pdf`)
}

export default function CustomerDashboard() {
    const router = useRouter()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [downloading, setDownloading] = useState<string | null>(null)
    const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME)

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const result = await getCursorCollection("/auth/customer-dashboard", { collection: "bookings" })
                setData({ ...result, bookings: result.data } as any)
            } catch (err: any) {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    router.push("/login")
                    return
                }
                setError("Failed to load your bookings. Please try again.")
            } finally {
                setLoading(false)
            }
        }
        // Get business name from API
        api.get("/bussiness-info", { cache: false } as any)
            .then((r: any) => {
                if (r.data?.businessName) setBusinessName(resolveBusinessName(r.data.businessName))
            })
            .catch(() => { })
        fetchDashboard()
    }, [router])

    const bookings = data?.bookings ?? []

    const stats = useMemo(() => {
        const now = new Date()
        const upcoming = bookings.filter((b) => {
            if (!b.date) return false
            const d = new Date(`${b.date}T${b.time || "00:00"}`)
            return d >= now
        }).length
        const paid = bookings.filter((b) => b.invoiceStatus === "Paid").length
        const totalSpent = bookings.reduce(
            (sum, b) => sum + (b.invoiceId && b.total ? Number(b.total) : 0),
            0,
        )
        return { upcoming, paid, totalSpent }
    }, [bookings])

    const handleDownload = async (booking: Booking) => {
        if (!booking.invoiceId) return
        setDownloading(booking.id)
        try {
            await downloadInvoicePDF(booking, data?.name ?? "Customer", businessName)
        } finally {
            setDownloading(null)
        }
    }

    if (loading) {
        return (
            <AccountShell>
                <div className={styles.empty}>Loading your appointments…</div>
            </AccountShell>
        )
    }

    if (error || !data) {
        return (
            <AccountShell>
                <div className={styles.empty}>
                    <p className={styles.error}>{error || "Failed to load data"}</p>
                </div>
            </AccountShell>
        )
    }

    return (
        <AccountShell>
            <CustomerPageHeader
                title={`Hello, ${data.name.split(" ")[0]}`}
                subtitle={[data.email, data.phone].filter(Boolean).join(" · ")}
                chips={[
                    { label: "Total Bookings", value: bookings.length },
                    { label: "Upcoming", value: stats.upcoming },
                ]}
            />

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CustomerStatCard label="Total Bookings" value={bookings.length} icon={CalendarDays} />
                <CustomerStatCard label="Upcoming" value={stats.upcoming} icon={Clock3} />
                <CustomerStatCard label="Paid Invoices" value={stats.paid} icon={CheckCircle2} />
                <CustomerStatCard
                    label="Total Spent"
                    value={stats.totalSpent > 0 ? `৳${stats.totalSpent.toFixed(0)}` : "—"}
                    icon={Wallet}
                />
            </div>

            {bookings.length === 0 ? (
                <div className={styles.card}>
                    <div className={styles.empty}>No bookings yet. When you reserve a visit, it will show up here.</div>
                </div>
            ) : (
                <div className={styles.card}>
                    <div className="border-b border-[#eccd80]/12 bg-[#eccd80]/[0.04] px-4 py-3 mb-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#eccd80]">
                            Booking History
                        </p>
                    </div>
                    <div className={styles.tableWrap}>
                        <Table className={styles.table}>
                            <thead>
                                <tr>
                                    {["Date", "Time", "Services", "Artist", "Amount", "Status", ""].map((heading) => (
                                        <th key={heading}>{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((booking) => (
                                    <tr key={booking.id}>
                                        <td>{booking.date ? formatDate(booking.date) : "—"}</td>
                                        <td>{booking.time ? formatTime(booking.time) : "—"}</td>
                                        <td>{booking.services?.length ? booking.services.join(", ") : "—"}</td>
                                        <td>
                                            {booking.staff
                                                ? booking.staff.toLowerCase() === "any"
                                                    ? "Any"
                                                    : booking.staff
                                                : "—"}
                                        </td>
                                        <td>
                                            {booking.total != null
                                                ? `${booking.invoiceId ? "" : "~"}৳${Number(booking.total).toFixed(2)}`
                                                : "—"}
                                        </td>
                                        <td>
                                            {booking.invoiceStatus ? (
                                                <span
                                                    className={`${styles.badge} ${
                                                        booking.invoiceStatus === "Paid"
                                                            ? styles.badgePaid
                                                            : booking.invoiceStatus === "Partial"
                                                                ? styles.badgePartial
                                                                : styles.badgePending
                                                    }`}
                                                >
                                                    {booking.invoiceStatus}
                                                </span>
                                            ) : (
                                                <span className={`${styles.badge} ${styles.badgePending}`}>
                                                    {booking.appointmentStatus || "—"}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {booking.invoiceId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownload(booking)}
                                                    disabled={downloading === booking.id}
                                                    className={styles.ghostButton}
                                                >
                                                    <Download size={12} strokeWidth={1.8} />
                                                    PDF
                                                </button>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </div>
            )}
        </AccountShell>
    )
}

function CustomerStatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string
    value: string | number
    icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
}) {
    return (
        <div className="rounded-lg border border-[#eccd80]/15 bg-[#eccd80]/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#eccd80]/80">{label}</p>
                <Icon className="text-[#eccd80]/70" size={14} strokeWidth={1.8} />
            </div>
            <p className="text-xl font-semibold tabular-nums text-white">{value}</p>
        </div>
    )
}



