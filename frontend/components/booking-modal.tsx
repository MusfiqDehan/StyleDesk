"use client"
import { BranchSwitcher } from '@/components/branch-switcher'

import React, { useState, useEffect } from "react"
import { useBooking } from "@/context/BookingContext"
import { useCart } from "@/context/CartContext"
import { Service } from "@/lib/types"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from '@/lib/toast'
import { Check, ChevronLeft, X, Clock, Calendar, User, Phone } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { isArtistEmployeeRole } from "@/lib/employee-roles"

const API_BASE = '/api/backend'
const steps = [
    { id: 1, label: "Select" },
    { id: 2, label: "Schedule" },
    { id: 3, label: "Details" },
    { id: 4, label: "Confirm" },
]

type CatalogTab = "services" | "packages"

interface BookingPackage {
    id: string
    title: string
    price: number | string
    billingCycle?: string
    features?: string[]
}

function getProfileFromToken(): {
    name: string
    phone: string
    role: string
} {
    try {
        const token = localStorage.getItem("accessToken")
        if (!token) return { name: "", phone: "", role: "" }
        const payload = token.split(".")[1]
        const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
        const phone =
            localStorage.getItem("userPhone") ||
            decoded.phone ||
            ""
        return {
            name: decoded.clientName || decoded.name || decoded.employeeName || "",
            phone,
            role: decoded.role || "",
        }
    } catch {
        return { name: "", phone: "", role: "" }
    }
}

function isValidBdPhone(phone: string) {
    return /^(?:(?:\+?88)?01[3-9]\d{8}|1[3-9]\d{8})$/.test(phone.trim())
}

function formatDisplayDate(d: string) {
    if (!d) return ""
    const date = new Date(`${d}T12:00:00`)
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
    })
}

function formatDisplayTime(t: string) {
    if (!t) return ""
    const [hRaw, mRaw] = t.split(":")
    const h = Number(hRaw)
    const m = Number(mRaw || 0)
    if (Number.isNaN(h)) return t
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

export function BookingModal() {
    const {
        isOpen,
        closeBooking,
        selectedService,
        preSelectedStylist,
        initialServiceQty,
        initialPackageQty,
    } = useBooking()
    const { clearCart } = useCart()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [staffList, setStaffList] = useState<any[]>([])
    const [availableServices, setAvailableServices] = useState<Service[]>([])
    const [availablePackages, setAvailablePackages] = useState<BookingPackage[]>([])
    const [catalogTab, setCatalogTab] = useState<CatalogTab>("services")
    const [settings, setSettings] = useState<any>(null)
    const [taxRate, setTaxRate] = useState(0)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [serviceQty, setServiceQty] = useState<Record<string, number>>({})
    const [packageQty, setPackageQty] = useState<Record<string, number>>({})
    const [isAdminUser, setIsAdminUser] = useState(false)
    const [nameLocked, setNameLocked] = useState(true)
    const [phoneLocked, setPhoneLocked] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [formData, setFormData] = useState({
        clientName: "",
        phoneNumber: "",
        date: "",
        time: "",
        serviceId: "",
        serviceName: "",
        staff: "",
    })

    useEffect(() => {
        if (isOpen) {
            setStep(1)
            setSuccess(false)
            setErrors({})
            setCatalogTab("services")
            fetchStylists()
            fetchServices()
            fetchPackages()
            fetchSettings()
            fetchTaxRate()

            const profile = getProfileFromToken()
            const admin = profile.role === "admin"
            setIsAdminUser(admin)
            // Admin name locks after first save; phone stays editable every time
            setNameLocked(!admin || !!profile.name.trim())
            setPhoneLocked(!admin)

            setFormData({
                clientName: profile.name,
                phoneNumber: profile.phone,
                date: "",
                time: "",
                serviceId: selectedService?.id ?? "",
                serviceName: selectedService?.name ?? "",
                staff: preSelectedStylist ?? "",
            })

            if (initialServiceQty || initialPackageQty) {
                setServiceQty({ ...(initialServiceQty || {}) })
                setPackageQty({ ...(initialPackageQty || {}) })
                const hasPackages = Object.values(initialPackageQty || {}).some((q) => q > 0)
                const hasServices = Object.values(initialServiceQty || {}).some((q) => q > 0)
                setCatalogTab(hasPackages && !hasServices ? "packages" : "services")
            } else if (selectedService) {
                setServiceQty({ [selectedService.id]: 1 })
                setPackageQty({})
            } else {
                setServiceQty({})
                setPackageQty({})
            }
        }
    }, [isOpen, selectedService, preSelectedStylist, initialServiceQty, initialPackageQty])

    const fetchTaxRate = async () => {
        try {
            const res = await fetch(`${API_BASE}/invoice-setting`, { cache: "no-store" })
            const data = await res.json()
            if (data?.taxRate) setTaxRate(Number(data.taxRate))
        } catch { }
    }

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_BASE}/appointment-setting`, { cache: "no-store" })
            setSettings(await res.json())
        } catch { }
    }

    const fetchStylists = async () => {
        try {
            const res = await fetch(`${API_BASE}/employee/basic`, { cache: "no-store" })
            const data = await res.json()
            setStaffList(Array.isArray(data) ? data.filter((e: any) => isArtistEmployeeRole(e.role)) : [])
        } catch {
            setStaffList([])
        }
    }

    const fetchServices = async () => {
        try {
            const res = await fetch(`${API_BASE}/service/active`, { cache: "no-store" })
            setAvailableServices(await res.json())
        } catch { }
    }

    const fetchPackages = async () => {
        try {
            const res = await fetch(`${API_BASE}/makeover-packages`, { cache: "no-store" })
            const data = await res.json()
            setAvailablePackages(Array.isArray(data) ? data : [])
        } catch {
            setAvailablePackages([])
        }
    }

    const serviceCount = Object.values(serviceQty).reduce((n, q) => n + (q > 0 ? q : 0), 0)
    const packageCount = Object.values(packageQty).reduce((n, q) => n + (q > 0 ? q : 0), 0)
    const hasSelection = serviceCount > 0 || packageCount > 0

    const validateStep = (currentStep: number) => {
        const newErrors: Record<string, string> = {}
        if (currentStep === 1) {
            if (!hasSelection) newErrors.serviceId = "Please select at least one service or package"
        } else if (currentStep === 2) {
            if (!formData.date) newErrors.date = "Please select a date"
            if (!formData.time) {
                newErrors.time = "Please select a time"
            } else {
                const openingTime = settings?.openingTime || "09:00"
                const closingTime = settings?.closingTime || "21:00"
                const [h, m] = formData.time.split(":").map(Number)
                const [oh, om] = openingTime.split(":").map(Number)
                const [ch, cm] = closingTime.split(":").map(Number)
                const t = h * 60 + m
                if (t < oh * 60 + om || t > ch * 60 + cm)
                    newErrors.time = `Please select a time between ${openingTime} and ${closingTime}`
            }
        } else if (currentStep === 3) {
            if (!formData.clientName.trim()) {
                newErrors.clientName = isAdminUser && !nameLocked
                    ? "Please enter your full name"
                    : "Name is missing from your account"
            }
            if (!formData.phoneNumber.trim()) {
                newErrors.phoneNumber = isAdminUser
                    ? "Please enter your phone number"
                    : "Phone number is missing from your account"
            } else if (!isValidBdPhone(formData.phoneNumber)) {
                newErrors.phoneNumber = "Enter a valid Bangladeshi phone number (01XXXXXXXXX)"
            }
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const saveAdminContactIfNeeded = async () => {
        if (!isAdminUser) return true

        const token = localStorage.getItem("accessToken")
        if (!token) {
            toast.error("Please sign in again to save your profile")
            return false
        }

        const profile = getProfileFromToken()
        const name = formData.clientName.trim()
        const phone = formData.phoneNumber.trim()
        const nameUnchanged = nameLocked && name === (profile.name || "").trim()
        const phoneUnchanged = phone === (profile.phone || "").trim()
        // Still save when name was just filled in, or phone changed / first set
        if (nameUnchanged && phoneUnchanged && nameLocked) return true

        setSavingProfile(true)
        try {
            const res = await fetch(`${API_BASE}/auth/update-profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
                body: JSON.stringify({ name, phone }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) {
                const msg = data?.message
                    ? Array.isArray(data.message)
                        ? data.message[0]
                        : data.message
                    : "Failed to save your profile details"
                const isPhoneConflict =
                    res.status === 409 ||
                    /phone|already exists|duplicate/i.test(String(msg))
                if (isPhoneConflict) {
                    setErrors((prev) => ({
                        ...prev,
                        phoneNumber: String(msg),
                    }))
                    return false
                }
                toast.error(msg)
                return false
            }
            if (data?.accessToken) {
                localStorage.setItem("accessToken", data.accessToken)
                const maxAge = 10 * 24 * 60 * 60
                document.cookie = `accessToken=${encodeURIComponent(data.accessToken)}; path=/; max-age=${maxAge}; samesite=strict`
            }
            if (data?.phone || phone) {
                localStorage.setItem("userPhone", data?.phone || phone)
            }
            setNameLocked(true)
            // Phone stays editable for admin on future bookings
            setPhoneLocked(false)
            if (!nameLocked || !phoneUnchanged) {
                toast.success("Profile details saved")
            }
            return true
        } catch {
            toast.error("Failed to save your profile details")
            return false
        } finally {
            setSavingProfile(false)
        }
    }

    const handleNext = async () => {
        if (!validateStep(step) || step >= 4) return
        if (step === 3) {
            const saved = await saveAdminContactIfNeeded()
            if (!saved) return
        }
        setStep(step + 1)
    }
    const handleBack = () => {
        if (step > 1) setStep(step - 1)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (errors[name])
            setErrors((prev) => {
                const n = { ...prev }
                delete n[name]
                return n
            })
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (errors[name])
            setErrors((prev) => {
                const n = { ...prev }
                delete n[name]
                return n
            })
        if (name === "serviceId") {
            const s = availableServices.find((s) => s.id === value)
            if (s) setFormData((prev) => ({ ...prev, serviceName: s.name }))
        }
    }

    const clearSelectionError = () => {
        if (errors.serviceId)
            setErrors((prev) => {
                const n = { ...prev }
                delete n.serviceId
                return n
            })
    }

    const bumpService = (id: string, delta: number) => {
        const locked = !!selectedService && selectedService.id === id
        setServiceQty((prev) => {
            const current = prev[id] || 0
            const next = Math.max(locked ? 1 : 0, current + delta)
            const copy = { ...prev }
            if (next <= 0) delete copy[id]
            else copy[id] = next
            return copy
        })
        clearSelectionError()
    }

    const bumpPackage = (id: string, delta: number) => {
        setPackageQty((prev) => {
            const current = prev[id] || 0
            const next = Math.max(0, current + delta)
            const copy = { ...prev }
            if (next <= 0) delete copy[id]
            else copy[id] = next
            return copy
        })
        clearSelectionError()
    }

    const currentServices = availableServices
        .filter((s) => (serviceQty[s.id] || 0) > 0)
        .map((s) => ({ ...s, qty: serviceQty[s.id] || 0 }))
    const currentPackages = availablePackages
        .filter((p) => (packageQty[p.id] || 0) > 0)
        .map((p) => ({ ...p, qty: packageQty[p.id] || 0 }))

    // Services and packages are independent — selecting one never changes the other.
    const selectedServiceCount = currentServices.reduce((n, s) => n + s.qty, 0)
    const servicesTotal = currentServices.reduce((a, s) => a + Number(s.price) * s.qty, 0)
    const packagesTotal = currentPackages.reduce((a, p) => a + Number(p.price) * p.qty, 0)
    const subtotal = servicesTotal + packagesTotal
    // Round tax up to next taka whenever there is any fraction (e.g. 9081.98 → 9082)
    const tax = Math.ceil(subtotal * (taxRate / 100))
    const total = subtotal + tax

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const staff = formData.staff && formData.staff !== "Any Expert" ? formData.staff : "any"
            const serviceNames: string[] = []
            for (const s of currentServices) {
                for (let i = 0; i < s.qty; i++) serviceNames.push(s.name)
            }
            const packageTitles: string[] = []
            for (const p of currentPackages) {
                for (let i = 0; i < p.qty; i++) packageTitles.push(p.title)
            }
            const payload = {
                phoneNumber: formData.phoneNumber,
                clientName: formData.clientName,
                date: formData.date,
                time: formData.time,
                status: "Pending",
                staff,
                source: "Online",
                services: serviceNames,
                isPackage: packageTitles.length > 0,
                // Array preserves quantity (duplicates). Comma-joined packageName is legacy fallback.
                packageNames: packageTitles.length > 0 ? packageTitles : undefined,
                packageName: packageTitles.length > 0 ? packageTitles.join(", ") : undefined,
                totalAmount: Math.round(total * 100) / 100,
                dueAmount: Math.round(total * 100) / 100,
            }

            const res = await fetch(`${API_BASE}/appointments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json().catch(() => null)

            if (res.ok) {
                setSuccess(true)
                clearCart()
            } else {
                const msg = data?.message
                    ? Array.isArray(data.message)
                        ? data.message[0]
                        : data.message
                    : "Booking failed. Please try again."
                toast.error(msg)
            }
        } catch {
            toast.error("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const fieldClass = (hasError?: boolean) =>
        cn(
            "h-10 rounded-none border bg-[#0a0a0a] text-white placeholder:text-white/40",
            "focus-visible:ring-1 focus-visible:ring-[#ECCD80]/50 focus-visible:border-[#ECCD80]/70",
            hasError ? "border-red-500/70" : "border-white/20",
        )

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeBooking()}>
            <DialogContent
                data-public-modal="true"
                showCloseButton={false}
                overlayClassName="bg-black/75 backdrop-blur-[2px]"
                className={cn(
                    "sm:max-w-[460px] max-h-[min(560px,calc(100dvh-2rem))] flex flex-col gap-0 overflow-hidden p-0",
                    "rounded-none bg-[#1a1a1a] text-white",
                    "border-2 border-t-2 border-l-2 border-b border-r border-[#ECCD80]",
                    "shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(236,205,128,0.15)]",
                    "[&>button]:hidden",
                )}
            >
                {success ? (
                    <div className="flex flex-col items-center px-5 py-6 animate-in fade-in zoom-in-95 duration-400">
                        <DialogTitle className="sr-only">Request Received</DialogTitle>
                        <DialogDescription className="sr-only">
                            Thanks for your order. We will call you soon to confirm your appointment.
                        </DialogDescription>

                        <div className="flex size-12 shrink-0 items-center justify-center border border-[#ECCD80] text-[#ECCD80]" aria-hidden>
                            <Check className="h-5 w-5" strokeWidth={2.5} />
                        </div>

                        <div className="mt-4 max-w-[320px] text-center">
                            <h2
                                className="text-xl font-semibold capitalize text-white leading-tight"
                                style={{ fontFamily: "Playfair Display, serif" }}
                            >
                                Request <em className="italic font-normal">Received</em>
                            </h2>
                            <p
                                className="mt-3 text-[13px] leading-relaxed text-white/80"
                                style={{ fontFamily: "Inter, sans-serif" }}
                            >
                                Thanks for your order. We&apos;ll call you soon to confirm your appointment.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeBooking}
                            className="mt-6 flex h-10 w-full items-center justify-center bg-white px-6 text-[12px] font-semibold uppercase tracking-wide text-[#3e3e3e] transition-colors hover:bg-white/90"
                            style={{ fontFamily: "Inter, sans-serif" }}
                        >
                            Back to Website
                        </button>
                    </div>
                ) : (
                    <>
                {/* Header */}
                        <div className="flex items-center justify-between gap-3 border-b border-[#ECCD80]/20 px-4 py-3.5 sm:px-5">
                            <div className="min-w-0">
                        <BranchSwitcher />
                        <DialogTitle
                                    className="text-lg font-semibold leading-tight text-white sm:text-xl"
                                    style={{ fontFamily: "Playfair Display, serif" }}
                        >
                                    Book Your <em className="italic font-normal">Experience</em>
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                                    Complete the steps below to request your appointment
                        </DialogDescription>
                    </div>
                    <button
                                type="button"
                        onClick={closeBooking}
                                aria-label="Close"
                                className="flex h-8 w-8 shrink-0 items-center justify-center bg-white text-black transition-colors hover:bg-[#ECCD80]"
                    >
                                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                </div>

                {/* Step Tracker */}
                        <div className="px-4 pt-3.5 sm:px-5">
                    <div className="relative flex items-start justify-between">
                                <div className="absolute left-[14px] right-[14px] top-[11px] h-px bg-white/15" />
                                <div
                                    className="absolute left-[14px] top-[11px] h-px bg-[#ECCD80] transition-all duration-500 ease-out"
                                    style={{
                                        width:
                                            step <= 1
                                                ? "0%"
                                                : `calc(${((step - 1) / (steps.length - 1)) * 100}% - 28px)`,
                                    }}
                        />
                        {steps.map((s) => {
                            const done = step > s.id
                            const active = step === s.id
                            return (
                                        <div key={s.id} className="relative z-10 flex w-[56px] flex-col items-center gap-1.5">
                                            <div
                                                className={cn(
                                                    "flex h-6 w-6 items-center justify-center border transition-all duration-300",
                                                    done && "border-[#ECCD80] bg-[#ECCD80] text-black",
                                                    active && "border-white bg-white text-black",
                                                    !done && !active && "border-white/30 bg-[#1a1a1a] text-white/50",
                                                )}
                                            >
                                                {done ? (
                                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                                ) : (
                                                    <span className="text-[10px] font-semibold">{s.id}</span>
                                                )}
                                    </div>
                                    <span
                                                className={cn(
                                                    "text-[8px] uppercase tracking-[0.14em] transition-colors duration-300",
                                                    step >= s.id ? "text-white" : "text-white/40",
                                                )}
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Step Content */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[#ECCD80]/70">
                            <div key={step} className="animate-in fade-in slide-in-from-right-2 duration-300">
                                {/* Step 1: Services / Packages */}
                        {step === 1 && (
                            <div className="space-y-3">
                                <div className="space-y-2.5">
                                    <Label
                                                className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                                Services or Packages
                                    </Label>

                                            {/* Tabs */}
                                            <div className="grid grid-cols-2 border border-white/20">
                                                {(
                                                    [
                                                        { id: "services" as const, label: "Services", count: serviceCount },
                                                        { id: "packages" as const, label: "Packages", count: packageCount },
                                                    ] as const
                                                ).map((tab) => {
                                                    const active = catalogTab === tab.id
                                                    return (
                                                        <button
                                                            key={tab.id}
                                                            type="button"
                                                            onClick={() => setCatalogTab(tab.id)}
                                                            className={cn(
                                                                "relative flex h-9 items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold transition-colors",
                                                                active
                                                                    ? "bg-white text-black"
                                                                    : "bg-transparent text-white/65 hover:text-white hover:bg-white/5",
                                                            )}
                                                            style={{ fontFamily: "Inter, sans-serif" }}
                                                        >
                                                            {tab.label}
                                                            {tab.count > 0 && (
                                                                <span
                                                                    className={cn(
                                                                        "flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-bold",
                                                                        active ? "bg-black text-white" : "bg-[#ECCD80] text-black",
                                                                    )}
                                                                >
                                                                    {tab.count}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                        </div>

                                            {/* Catalog list */}
                                            <div className="max-h-[150px] overflow-y-auto border border-white/20 bg-[#0a0a0a] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[#ECCD80]">
                                                {catalogTab === "services" ? (
                                                    availableServices.length === 0 ? (
                                                        <p className="px-4 py-8 text-center text-[12px] text-white/50">
                                                            Loading services…
                                                        </p>
                                                    ) : (
                                                        availableServices.map((s) => {
                                                            const qty = serviceQty[s.id] || 0
                                                            const selected = qty > 0
                                                            const locked = !!selectedService && selectedService.id === s.id
                                                    return (
                                                        <div
                                                            key={s.id}
                                                                    className={cn(
                                                                        "flex w-full items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 text-left last:border-0",
                                                                        selected ? "bg-[#ECCD80]/10" : "",
                                                                    )}
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <span className="block break-words text-[12px] font-medium text-white">
                                                                            {s.name}
                                                                        </span>
                                                                        <span
                                                                            className={cn(
                                                                                "mt-0.5 block font-mono text-[10px]",
                                                                                selected ? "text-[#ECCD80]" : "text-white/55",
                                                                            )}
                                                                        >
                                                                            {formatCurrency(s.price).replace("Tk", "৳")}
                                                                        </span>
                                                                </div>
                                                                    <div className="flex shrink-0 items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={qty === 0 || (locked && qty <= 1)}
                                                                            aria-label={`Decrease ${s.name}`}
                                                                            className="flex h-6 w-6 items-center justify-center border border-white/25 text-[13px] font-bold text-white transition-colors hover:border-[#ECCD80]/60 hover:bg-[#ECCD80]/10 disabled:cursor-not-allowed disabled:opacity-25"
                                                                            onClick={() => bumpService(s.id, -1)}
                                                                        >
                                                                            −
                                                                        </button>
                                                                        <span className="w-5 text-center text-[12px] font-semibold tabular-nums text-white select-none">
                                                                            {qty > 0 ? (
                                                                                qty
                                                                            ) : (
                                                                                <span className="text-white/35">0</span>
                                                                            )}
                                                            </span>
                                                                        <button
                                                                            type="button"
                                                                            aria-label={`Increase ${s.name}`}
                                                                            className="flex h-6 w-6 items-center justify-center border border-white/25 text-[13px] font-bold text-white transition-colors hover:border-[#ECCD80]/60 hover:bg-[#ECCD80]/10"
                                                                            onClick={() => bumpService(s.id, 1)}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                        </div>
                                                    )
                                                        })
                                                    )
                                                ) : availablePackages.length === 0 ? (
                                                    <p className="px-4 py-8 text-center text-[12px] text-white/50">
                                                        No packages available
                                                    </p>
                                                ) : (
                                                    availablePackages.map((pkg) => {
                                                        const qty = packageQty[pkg.id] || 0
                                                        const selected = qty > 0
                                                        return (
                                                            <div
                                                                key={pkg.id}
                                                                className={cn(
                                                                    "flex w-full items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 text-left last:border-0",
                                                                    selected ? "bg-[#ECCD80]/10" : "",
                                                                )}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="block break-words text-[12px] font-medium text-white">
                                                                        {pkg.title}
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            "mt-0.5 block font-mono text-[10px]",
                                                                            selected ? "text-[#ECCD80]" : "text-white/55",
                                                                        )}
                                                                    >
                                                                        {formatCurrency(Number(pkg.price)).replace("Tk", "৳")}
                                                                    </span>
                                            </div>
                                                                <div className="flex shrink-0 items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        disabled={qty === 0}
                                                                        aria-label={`Decrease ${pkg.title}`}
                                                                        className="flex h-6 w-6 items-center justify-center border border-white/25 text-[13px] font-bold text-white transition-colors hover:border-[#ECCD80]/60 hover:bg-[#ECCD80]/10 disabled:cursor-not-allowed disabled:opacity-25"
                                                                        onClick={() => bumpPackage(pkg.id, -1)}
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <span className="w-5 text-center text-[12px] font-semibold tabular-nums text-white select-none">
                                                                        {qty > 0 ? (
                                                                            qty
                                                                        ) : (
                                                                            <span className="text-white/35">0</span>
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`Increase ${pkg.title}`}
                                                                        className="flex h-6 w-6 items-center justify-center border border-white/25 text-[13px] font-bold text-white transition-colors hover:border-[#ECCD80]/60 hover:bg-[#ECCD80]/10"
                                                                        onClick={() => bumpPackage(pkg.id, 1)}
                                                                    >
                                                                        +
                                                                    </button>
                                            </div>
                                        </div>
                                                        )
                                                    })
                                    )}
                                </div>

                                            {errors.serviceId && (
                                                <p className="mt-1 text-[11px] tracking-wide text-red-400">
                                                    {errors.serviceId}
                                                </p>
                                            )}
                                </div>

                                        {hasSelection && (
                                            <div className="border border-[#ECCD80]/25 bg-black/40 px-3 py-2.5 space-y-1.5">
                                                {selectedServiceCount > 0 && (
                                                    <div className="flex justify-between gap-3 text-[12px]">
                                                        <span className="text-white/85">
                                                            Services ({selectedServiceCount})
                                                        </span>
                                                        <span className="shrink-0 text-white">
                                                            {formatCurrency(servicesTotal)}
                                                        </span>
                                            </div>
                                                )}
                                                {currentPackages.length > 0 && (
                                                    <div className="flex justify-between gap-3 text-[12px]">
                                                        <span className="text-white/85">
                                                            Packages ({packageCount})
                                                        </span>
                                                        <span className="shrink-0 text-white">
                                                            {formatCurrency(packagesTotal)}
                                                        </span>
                                                    </div>
                                                )}
                                        {taxRate > 0 && (
                                                    <div className="flex justify-between text-[12px]">
                                                        <span className="text-white/70">VAT ({taxRate}%)</span>
                                                <span className="text-white">{formatCurrency(tax)}</span>
                                            </div>
                                        )}
                                                <div className="flex justify-between border-t border-white/15 pt-1.5">
                                                    <span className="text-[11px] text-white/80">Total</span>
                                                    <span className="text-sm font-semibold text-[#ECCD80]">
                                                        {formatCurrency(total)}
                                                    </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                                {/* Step 2: Date & Time */}
                        {step === 2 && (
                                    <div className="space-y-3.5">
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label
                                                    className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                        Date
                                    </Label>
                                    <div className="relative">
                                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ECCD80]" />
                                        <Input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            min={new Date().toISOString().split("T")[0]}
                                                        max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                                            .toISOString()
                                                            .split("T")[0]}
                                                        className={cn(fieldClass(!!errors.date), "pl-9 [color-scheme:dark]")}
                                        />
                                    </div>
                                                {errors.date && (
                                                    <p className="text-[11px] tracking-wide text-red-400">{errors.date}</p>
                                                )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label
                                                    className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                        Time
                                    </Label>
                                    <div className="relative">
                                                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ECCD80]" />
                                        <Input
                                            type="time"
                                            name="time"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                                        className={cn(fieldClass(!!errors.time), "pl-9 [color-scheme:dark]")}
                                        />
                                    </div>
                                                {errors.time && (
                                                    <p className="text-[11px] tracking-wide text-red-400">{errors.time}</p>
                                                )}
                                            </div>
                                </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                                style={{ fontFamily: "Inter, sans-serif" }}
                                            >
                                                Preferred Artist
                                            </Label>
                                            <Select
                                                disabled={!!preSelectedStylist}
                                                value={formData.staff || undefined}
                                                onValueChange={(val) => handleSelectChange("staff", val)}
                                            >
                                                <SelectTrigger className={cn(fieldClass(), "w-full")}>
                                                    <SelectValue placeholder="Any Expert (Default)" />
                                                </SelectTrigger>
                                                <SelectContent className="z-[80] rounded-none border-[#ECCD80]/30 bg-[#141414] text-white">
                                                    <SelectItem
                                                        value="Any Expert"
                                                        className="rounded-none focus:bg-[#ECCD80] focus:text-black"
                                                    >
                                                        Any Expert (Default)
                                                    </SelectItem>
                                                    {staffList.map((s) => (
                                                        <SelectItem
                                                            key={s.id}
                                                            value={s.name}
                                                            className="rounded-none focus:bg-[#ECCD80] focus:text-black"
                                                        >
                                                            {s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[11px] text-white/50">
                                                Open {settings?.openingTime || "09:00"} – {settings?.closingTime || "21:00"}
                                            </p>
                                        </div>
                            </div>
                        )}

                                {/* Step 3: Details */}
                        {step === 3 && (
                            <div className="space-y-3.5">
                                <div className="space-y-1.5">
                                    <Label
                                                className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                        Full Name
                                    </Label>
                                    <div className="relative">
                                                <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ECCD80]/70" />
                                        <Input
                                            name="clientName"
                                            value={formData.clientName}
                                                    onChange={handleInputChange}
                                                    readOnly={nameLocked}
                                                    tabIndex={nameLocked ? -1 : 0}
                                                    placeholder={
                                                        isAdminUser && !nameLocked
                                                            ? "e.g. Alex Rahman"
                                                            : "e.g. Alex Rahman"
                                                    }
                                                    className={cn(
                                                        fieldClass(!!errors.clientName),
                                                        "pl-9",
                                                        nameLocked
                                                            ? "cursor-default select-none text-white/85 focus-visible:ring-0"
                                                            : "text-white",
                                                    )}
                                        />
                                    </div>
                                            {errors.clientName && (
                                                <p className="text-[11px] tracking-wide text-red-400">
                                                    {errors.clientName}
                                                </p>
                                            )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label
                                                className="text-[10px] uppercase tracking-[0.18em] text-white/80"
                                        style={{ fontFamily: "Inter, sans-serif" }}
                                    >
                                        Phone Number
                                    </Label>
                                    <div className="relative">
                                                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#ECCD80]/70" />
                                        <Input
                                            name="phoneNumber"
                                            value={formData.phoneNumber}
                                                    onChange={handleInputChange}
                                                    readOnly={!isAdminUser && phoneLocked}
                                                    tabIndex={!isAdminUser && phoneLocked ? -1 : 0}
                                                    inputMode="tel"
                                                    maxLength={14}
                                                    placeholder={
                                                        isAdminUser ? "e.g. 01712345678" : "e.g. 01712345678"
                                                    }
                                                    className={cn(
                                                        fieldClass(!!errors.phoneNumber),
                                                        "pl-9",
                                                        !isAdminUser && phoneLocked
                                                            ? "cursor-default select-none text-white/85 focus-visible:ring-0"
                                                            : "text-white",
                                                    )}
                                        />
                                    </div>
                                            {errors.phoneNumber && (
                                                <p className="text-[11px] tracking-wide text-red-400">
                                                    {errors.phoneNumber}
                                                </p>
                                            )}
                                </div>
                            </div>
                        )}

                                {/* Step 4: Confirm */}
                        {step === 4 && (
                            <div className="space-y-3">
                                        <div className="border border-white/15 bg-black/50">
                                            <div className="border-b border-white/10 px-3.5 py-2">
                                                <p
                                                    className="text-[10px] uppercase tracking-[0.22em] text-[#ECCD80]"
                                                    style={{ fontFamily: "Inter, sans-serif" }}
                                                >
                                            Booking Summary
                                        </p>
                                    </div>
                                            <div className="divide-y divide-white/10">
                                                {selectedServiceCount > 0 && (
                                                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                        <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                            Services ({selectedServiceCount})
                                                        </span>
                                                        <span className="text-[12px] text-white">
                                                            {formatCurrency(servicesTotal)}
                                                        </span>
                                            </div>
                                                )}
                                                {currentPackages.length > 0 && (
                                                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                        <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                            Packages ({packageCount})
                                                        </span>
                                                        <span className="text-[12px] text-white">
                                                            {formatCurrency(packagesTotal)}
                                                        </span>
                                        </div>
                                                )}
                                                {taxRate > 0 && (
                                                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                        <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                            VAT ({taxRate}%)
                                                        </span>
                                                        <span className="text-[12px] text-white">
                                                            {formatCurrency(tax)}
                                                        </span>
                                        </div>
                                                )}
                                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                        Artist
                                                    </span>
                                                    <span className="text-[12px] text-white">
                                                        {formData.staff || "Any Expert"}
                                                    </span>
                                        </div>
                                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                        Date
                                                    </span>
                                                    <span className="text-[12px] text-white text-right">
                                                        {formatDisplayDate(formData.date)}
                                                    </span>
                                        </div>
                                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-white/55">
                                                        Time
                                                    </span>
                                                    <span className="text-[12px] text-white">
                                                        {formatDisplayTime(formData.time)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 bg-white/[0.03] px-3.5 py-3">
                                                    <span className="text-[10px] uppercase tracking-wider text-white/70">
                                                        Total
                                                    </span>
                                                    <span className="text-base font-semibold text-[#ECCD80]">
                                                        {formatCurrency(total)}
                                                    </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                        {/* Footer */}
                        <div className="border-t border-[#ECCD80]/20 px-4 py-3 sm:px-5">
                    <div className="flex gap-2.5">
                        {step > 1 && (
                            <button
                                        type="button"
                                onClick={handleBack}
                                        className="flex h-10 flex-1 items-center justify-center gap-1.5 border border-white/25 bg-transparent text-[10px] uppercase tracking-[0.18em] text-white transition-colors hover:border-[#ECCD80] hover:text-[#ECCD80]"
                                style={{ fontFamily: "Inter, sans-serif" }}
                            >
                                        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                                Back
                            </button>
                        )}

                        {step < 4 ? (
                            <button
                                        type="button"
                                        onClick={() => void handleNext()}
                                        disabled={(step === 1 && !hasSelection) || savingProfile}
                                        className={cn(
                                            "flex h-10 flex-1 items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors",
                                            (step === 1 && !hasSelection) || savingProfile
                                                ? "cursor-not-allowed bg-[#2a2a2a] text-white/35"
                                                : "bg-white text-black hover:bg-[#ECCD80]",
                                        )}
                                style={{ fontFamily: "Inter, sans-serif" }}
                            >
                                        {savingProfile ? "Saving…" : "Continue"}
                            </button>
                        ) : (
                            <button
                                        type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                        className="flex h-10 flex-1 items-center justify-center gap-2 bg-white text-[10px] uppercase tracking-[0.18em] font-semibold text-black transition-colors hover:bg-[#ECCD80] disabled:opacity-50"
                                style={{ fontFamily: "Inter, sans-serif" }}
                            >
                                {loading ? (
                                    <>
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                                                Sending Request
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                Request Booking
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
