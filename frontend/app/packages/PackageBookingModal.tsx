"use client"

import { BranchSwitcher } from "@/components/branch-switcher"
import { useState, useEffect } from "react"
import { X, Phone, User, Calendar, Clock, FileText, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Check } from "lucide-react"
import { bookPackage } from "@admin/api/packages/packages"
import api from "@admin/api/base"
import { getInvoiceSettings } from "@admin/api/settings/settings"
import { isArtistEmployeeRole } from "@/lib/employee-roles"
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
import { formatCurrency } from "@/lib/utils"

interface Package {
  id: string
  title: string
  price: number | string
  billingCycle?: string
}

interface PackageBookingModalProps {
  pkg: Package | null
  onClose: () => void
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("8801") && digits.length === 13) return digits
  if (digits.startsWith("01") && digits.length === 11) return digits
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`
  return digits
}

function getProfileFromToken(): { name: string; phone: string } {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return { name: "", phone: "" }
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const phone = localStorage.getItem('userPhone') || decoded.phone || ""
    return { name: decoded.clientName || decoded.name || "", phone }
  } catch { return { name: "", phone: "" } }
}

const MIN_DATE = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
})()

const MAX_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
})()

function calcTotal(price: number | string, taxRate: number): string {
  const base = parseFloat(String(price)) || 0
  // Ceil (not plain division) to match the rounding used everywhere else (booking confirm, receipts)
  const tax = Math.ceil((base * taxRate) / 100)
  return (base + tax).toFixed(2)
}

const steps = [
  { id: 1, label: "Package" },
  { id: 2, label: "Schedule" },
  { id: 3, label: "Details" },
  { id: 4, label: "Confirm" },
]

export default function PackageBookingModal({ pkg, onClose }: PackageBookingModalProps) {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState("")
  const [clientName, setClientName] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [staff, setStaff] = useState("")
  const [staffList, setStaffList] = useState<any[]>([])
  const [taxRate, setTaxRate] = useState(0)
  const [settings, setSettings] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch tax rate and staff list on mount
  useEffect(() => {
    getInvoiceSettings()
      .then((s) => { if (s?.taxRate) setTaxRate(Number(s.taxRate)) })
      .catch(() => { })

    api.get("/employee/basic")
      .then((res) => {
        const artists = Array.isArray(res.data) ? res.data.filter((emp: any) => isArtistEmployeeRole(emp.role)) : []
        setStaffList(artists)
      })
      .catch(() => { })

    api.get("/appointment-setting")
      .then((res) => {
        setSettings(res.data)
      })
      .catch(() => { })
  }, [])

  // Reset form and auto-fill profile when pkg changes
  useEffect(() => {
    if (pkg) {
      const { name: loggedInName, phone: loggedInPhone } = getProfileFromToken()
      setStep(1)
      setClientName(loggedInName)
      setPhone(loggedInPhone)
      setDate("")
      setTime("")
      setNotes("")
      setStaff("")
      setErrors({})
      setSuccess(false)
    }
  }, [pkg?.id])

  const validateStep = (currentStep: number) => {
    const e: Record<string, string> = {}
    if (currentStep === 2) {
      if (!date) e.date = "Date is required."
      else if (date < MIN_DATE) e.date = "Please select a valid upcoming date."
      if (!time) {
        e.time = "Time is required."
      } else if (settings) {
        const openingTime = settings.openingTime || "09:00"
        const closingTime = settings.closingTime || "21:00"
        const [h, m] = time.split(":").map(Number)
        const [oh, om] = openingTime.split(":").map(Number)
        const [ch, cm] = closingTime.split(":").map(Number)
        const t = h * 60 + m
        const start = oh * 60 + om
        const end = ch * 60 + cm
        if (t < start || t > end) {
          e.time = `Please select a time between ${openingTime} and ${closingTime}`
        }
      }
    } else if (currentStep === 3) {
      if (!clientName.trim()) e.clientName = "Name is missing from your account."
      if (!phone.trim()) e.phone = "Phone number is missing from your account."
      else if (!/^\d{11}$/.test(normalizePhone(phone))) e.phone = "Please enter a valid Bangladeshi Phone Number."
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validateStep(step) && step < 4) setStep(step + 1) }
  const handleBack = () => { if (step > 1) setStep(step - 1) }

  const handleSubmit = async () => {
    if (!pkg) return
    try {
      setIsSubmitting(true)
      await bookPackage(pkg.id, {
        clientName: clientName.trim(),
        phoneNumber: normalizePhone(phone),
        date,
        time,
        source: "online",
        staff: staff === "Any Expert" ? "any" : staff,
        isPackage: true,
        packageName: pkg.title,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      setSuccess(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      const parsed = Array.isArray(msg) ? msg.join(", ") : msg || "Booking failed. Please try again."
      setErrors({ submit: parsed })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (d: string) => {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  if (!pkg) return null

  return (
    <Dialog open={!!pkg} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-[580px] bg-[#0c0c0c] border border-white/10 text-white p-0 overflow-hidden gap-0 [&>button]:hidden shadow-2xl"
      >
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-0">
          <div>
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.5em] text-[#c4a484]" style={{ fontFamily: "Inter, sans-serif" }}>
              Package Booking
            </p>
            <BranchSwitcher />
            <DialogTitle className="text-[1.6rem] font-semibold leading-tight text-white" style={{ fontFamily: "Playfair Display, serif" }}>
              {pkg.title}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[11px] text-white/50 tracking-wide" style={{ fontFamily: "Inter, sans-serif" }}>
              Complete the steps to book this curated luxury experience
            </DialogDescription>
          </div>
          <button
            onClick={onClose}
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center border border-white/20 text-white transition-all duration-200 hover:border-white/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {success ? (
          <div className="px-8 py-16 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center border border-[#c4a484]/30 bg-[#c4a484]/5">
                <CheckCircle2 className="w-8 h-8 text-[#c4a484]" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif text-white">Booking Confirmed!</h3>
              <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
                Your package booking has been received. Our team will contact you shortly to confirm.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-12 py-4 bg-white text-black text-[10px] font-bold tracking-[0.3em] uppercase hover:bg-[#c4a484] hover:text-white transition-all duration-300"
            >
              Close Window
            </button>
          </div>
        ) : (
          <>
            {/* Step Tracker */}
            <div className="px-8 pt-7">
              <div className="relative flex items-start justify-between">
                <div className="absolute left-4 right-4 top-[15px] h-px bg-white/8" />
                <div
                  className="absolute left-4 top-[15px] h-px bg-[#c4a484]/50 transition-all duration-500 ease-out"
                  style={{ width: `calc(${((step - 1) / 3) * 100}% - 2rem)` }}
                />
                {steps.map((s) => {
                  const done = step > s.id
                  const active = step === s.id
                  return (
                    <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`flex h-[30px] w-[30px] items-center justify-center border transition-all duration-300 ${done
                        ? "border-[#c4a484] bg-[#c4a484] text-white"
                        : active
                          ? "border-white bg-white text-black"
                          : "border-white/15 bg-[#0c0c0c] text-white/25"
                        }`}>
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="text-[11px] font-medium">{s.id}</span>}
                      </div>
                      <span className={`text-[9px] uppercase tracking-[0.22em] transition-colors duration-300 ${step >= s.id ? "text-white" : "text-white/45"
                        }`} style={{ fontFamily: "Inter, sans-serif" }}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mx-8 mt-6 h-px bg-white/6" />

            {/* Step Content */}
            <div className="px-8 py-8 min-h-[320px]">
              <div key={step} className="animate-in fade-in slide-in-from-right-3 duration-300">

                {/* Step 1: Package & Expert */}
                {step === 1 && (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Selected Package</Label>
                      <div className="p-5 border border-white/10 bg-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-lg font-serif text-white">{pkg.title}</p>
                          <p className="text-white/40 text-[11px] mt-1 uppercase tracking-wider">
                            ৳{Number(pkg.price).toLocaleString()} / {pkg.billingCycle || "session"}
                          </p>
                        </div>
                        <Check className="w-5 h-5 text-[#c4a484]" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Preferred Expert</Label>
                      <Select value={staff} onValueChange={setStaff}>
                        <SelectTrigger className="h-14 rounded-none border-white/10 bg-transparent text-white focus:ring-[#c4a484]/20">
                          <SelectValue placeholder="Any Expert (Default)" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#111] text-white">
                          <SelectItem value="Any Expert" className="focus:bg-white focus:text-black">Any Expert (Default)</SelectItem>
                          {staffList.map((s) => (
                            <SelectItem key={s.id} value={s.name} className="focus:bg-white focus:text-black">{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Step 2: Schedule */}
                {step === 2 && (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Date</Label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          min={MIN_DATE}
                          max={MAX_DATE}
                          className={`h-14 rounded-none border-white/10 bg-transparent pl-11 text-white [color-scheme:dark] focus-visible:ring-[#c4a484]/20 ${errors.date ? "border-red-500/70" : ""}`}
                        />
                      </div>
                      {errors.date && <p className="text-[10px] text-red-400 uppercase tracking-widest">{errors.date}</p>}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Time</Label>
                      <div className="relative">
                        <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className={`h-14 rounded-none border-white/10 bg-transparent pl-11 text-white [color-scheme:dark] focus-visible:ring-[#c4a484]/20 ${errors.time ? "border-red-500/70" : ""}`}
                        />
                      </div>
                      {errors.time && <p className="text-[10px] text-red-400 uppercase tracking-widest">{errors.time}</p>}
                    </div>

                    {settings && (
                      <div className="col-span-full flex items-center gap-3 border border-white/6 bg-white/[0.02] px-4 py-3">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                        <p className="text-[11px] text-white/40" style={{ fontFamily: "Inter, sans-serif" }}>
                          We are open {settings.openingTime || "09:00"} — {settings.closingTime || "21:00"}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Details */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Full Name</Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input placeholder="e.g. Alex Rahman"
                          value={clientName}
                          readOnly
                          tabIndex={-1}
                          className={`h-14 rounded-none border-white/8 bg-white/[0.03] pl-11 text-white/60 cursor-default select-none focus-visible:ring-0 focus-visible:border-white/8 ${errors.clientName ? "border-red-500/70" : ""}`}
                        />
                      </div>
                      {errors.clientName && <p className="text-[10px] text-red-400 uppercase tracking-widest">{errors.clientName}</p>}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Phone Number</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input placeholder="e.g. 01712345678"
                          value={phone}
                          readOnly
                          tabIndex={-1}
                          className={`h-14 rounded-none border-white/8 bg-white/[0.03] pl-11 text-white/60 cursor-default select-none focus-visible:ring-0 focus-visible:border-white/8 ${errors.phone ? "border-red-500/70" : ""}`}
                        />
                      </div>
                      {errors.phone && <p className="text-[10px] text-red-400 uppercase tracking-widest">{errors.phone}</p>}
                    </div>

                    <p className="text-center text-[10px] text-white/30 uppercase tracking-[0.2em]">
                      To update your details, visit your profile settings.
                    </p>

                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-[0.28em] text-white/50">Special Notes (Optional)</Label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Please use fragrance-free products."
                        className="w-full h-24 bg-transparent border border-white/10 p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#c4a484]/50 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Confirmation */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="border border-white/10 bg-white/[0.02]">
                      <div className="px-5 py-4 border-b border-white/5">
                        <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">Booking Summary</p>
                      </div>
                      <div className="divide-y divide-white/5">
                        <div className="flex justify-between px-5 py-4 text-sm">
                          <span className="text-white/40 uppercase tracking-wider text-[11px]">Experience</span>
                          <span className="text-white">{pkg.title}</span>
                        </div>
                        <div className="flex justify-between px-5 py-4 text-sm">
                          <span className="text-white/40 uppercase tracking-wider text-[11px]">Expert</span>
                          <span className="text-white">{staff || "Any Expert"}</span>
                        </div>
                        <div className="flex justify-between px-5 py-4 text-sm">
                          <span className="text-white/40 uppercase tracking-wider text-[11px]">Schedule</span>
                          <div className="text-right">
                            <p className="text-white">{formatDate(date)}</p>
                            <p className="text-[#c4a484] text-xs mt-1">{time}</p>
                          </div>
                        </div>
                        <div className="flex justify-between px-5 py-5 bg-white/[0.03]">
                          <span className="text-white/60 uppercase tracking-[0.2em] text-[11px] font-bold">Total (incl. tax)</span>
                          <span className="text-xl font-serif text-[#c4a484]">৳{calcTotal(pkg.price, taxRate)}</span>
                        </div>
                      </div>
                    </div>

                    {errors.submit && (
                      <p className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center uppercase tracking-widest">
                        {errors.submit}
                      </p>
                    )}

                    <p className="text-center text-[10px] text-white/30 uppercase tracking-[0.2em]">
                      Final confirmation will be sent via phone call
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="border-t border-white/8 px-8 py-6">
              <div className="flex gap-4">
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    className="flex h-14 flex-1 items-center justify-center gap-2 border border-white/10 bg-transparent text-[10px] uppercase tracking-[0.3em] text-white transition-all hover:bg-white/5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                )}

                {step < 4 ? (
                  <button
                    onClick={handleNext}
                    className="flex h-14 flex-1 items-center justify-center gap-2 bg-white text-[10px] uppercase tracking-[0.3em] text-black transition-all hover:bg-[#c4a484] hover:text-white"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex h-14 flex-1 items-center justify-center gap-3 bg-[#c4a484] text-[10px] uppercase tracking-[0.3em] text-white transition-all hover:bg-[#b39373] disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing</>
                    ) : (
                      <><Check className="h-4 w-4" /> Confirm Booking</>
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
