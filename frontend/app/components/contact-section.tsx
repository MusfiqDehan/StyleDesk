"use client"

import { useMemo, useState } from "react"
import { useBusiness } from "@/context/BusinessContext"
import { toast } from '@/lib/toast'
import { resolveBusinessName } from "@/lib/business-branding"
import { toGoogleMapsEmbedUrl } from "@/lib/google-maps-embed"

type ContactSectionProps = {
    id?: string
    standalone?: boolean
}

export function ContactSection({ id, standalone = false }: ContactSectionProps) {
    const { businessInfo, businessName } = useBusiness()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [message, setMessage] = useState("")

    const brandName = resolveBusinessName(businessInfo?.businessName || businessName)
    const contactEmail = businessInfo?.email || "admin@admin.com"
    const contactPhone = businessInfo?.phone || "+880000000000"
    const contactAddress = businessInfo?.address || "Mirpur DOHS, Pallabi, Dhaka 1216, Bangladesh"
    const contactSectionTitle = businessInfo?.contactSectionTitle || "Let's Plan Your Next Beauty Experience"
    const contactSectionDescription =
        businessInfo?.contactSectionDescription ||
        "Reach out for appointments, package consultation, and tailored beauty recommendations. Our team will get back to you quickly."

    const cleanPhone = useMemo(() => contactPhone.replace(/\s+/g, ""), [contactPhone])
    const mapsUrl = useMemo(
        () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactAddress)}`,
        [contactAddress]
    )
    const mapEmbedUrl = useMemo(() => {
        const configured = businessInfo?.mapEmbedUrl?.trim()
        return toGoogleMapsEmbedUrl(configured, contactAddress)
    }, [businessInfo?.mapEmbedUrl, contactAddress])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !email.trim() || !message.trim()) {
            toast.error("Please fill in your name, email, and message.")
            return
        }

        const subject = `New contact request from ${name.trim()}`
        const body = [
            `Name: ${name.trim()}`,
            `Email: ${email.trim()}`,
            `Phone: ${phone.trim() || "N/A"}`,
            "",
            "Message:",
            message.trim(),
        ].join("\n")

        window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        toast.success("Your email client has been opened.")
    }

    return (
        <section
            id={id}
            className={`relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 ${standalone ? "lg:py-24" : "lg:py-20"}`}
        >
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#CDB37F]/10 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-7xl">
                <div className="mb-10 text-center sm:mb-12">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                        CONTACT US
                    </p>
                    <h2 className="text-[1.75rem] font-medium leading-tight text-white sm:text-4xl lg:text-5xl" style={{ fontFamily: "Playfair Display, serif" }}>
                        {contactSectionTitle}
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/70" style={{ fontFamily: "Inter, sans-serif" }}>
                        {contactSectionDescription}
                    </p>
                </div>

                {standalone && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:gap-8">
                        <div className="space-y-4">
                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Call Us
                                </p>
                                <a
                                    href={`tel:${cleanPhone}`}
                                    className="mt-2 block text-lg text-white transition-colors hover:text-[#CDB37F] sm:text-xl"
                                    style={{ fontFamily: "Playfair Display, serif" }}
                                >
                                    {contactPhone}
                                </a>
                            </article>

                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Email
                                </p>
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="mt-2 block break-all text-lg text-white transition-colors hover:text-[#CDB37F] sm:text-xl"
                                    style={{ fontFamily: "Playfair Display, serif" }}
                                >
                                    {contactEmail}
                                </a>
                            </article>

                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Visit
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-white/80" style={{ fontFamily: "Inter, sans-serif" }}>
                                    {contactAddress}
                                </p>
                                <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex items-center border border-[#CDB37F]/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CDB37F] transition-colors hover:bg-[#CDB37F] hover:text-black"
                                    style={{ fontFamily: "Inter, sans-serif" }}
                                >
                                    Open In Google Maps
                                </a>
                            </article>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-2 sm:p-3">
                            <div className="h-[320px] overflow-hidden rounded-xl sm:h-[380px] lg:h-full lg:min-h-[440px]">
                                <iframe
                                    title={`${brandName} Location`}
                                    src={mapEmbedUrl}
                                    className="h-full w-full border-0"
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    </div>
                )}

                {!standalone && (
                    <div className="grid gap-6 lg:grid-cols-[1.05fr_1.2fr] lg:gap-8">
                        <div className="space-y-4">
                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Call Us
                                </p>
                                <a
                                    href={`tel:${cleanPhone}`}
                                    className="mt-2 block text-lg text-white transition-colors hover:text-[#CDB37F] sm:text-xl"
                                    style={{ fontFamily: "Playfair Display, serif" }}
                                >
                                    {contactPhone}
                                </a>
                            </article>

                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Email
                                </p>
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="mt-2 block break-all text-lg text-white transition-colors hover:text-[#CDB37F] sm:text-xl"
                                    style={{ fontFamily: "Playfair Display, serif" }}
                                >
                                    {contactEmail}
                                </a>
                            </article>

                            <article className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                    Visit
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-white/80" style={{ fontFamily: "Inter, sans-serif" }}>
                                    {contactAddress}
                                </p>
                                <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex items-center border border-[#CDB37F]/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CDB37F] transition-colors hover:bg-[#CDB37F] hover:text-black"
                                    style={{ fontFamily: "Inter, sans-serif" }}
                                >
                                    Open Map
                                </a>
                            </article>
                        </div>

                        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#101010] p-5 sm:p-7">
                            <p className="mb-5 text-[10px] uppercase tracking-[0.28em] text-[#CDB37F]" style={{ fontFamily: "Inter, sans-serif" }}>
                                Send Message
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="sm:col-span-1">
                                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/60" style={{ fontFamily: "Inter, sans-serif" }}>Name</span>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-11 w-full border border-white/15 bg-black/40 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#CDB37F]/65"
                                        placeholder="e.g. Alex Rahman"
                                        required
                                    />
                                </label>

                                <label className="sm:col-span-1">
                                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/60" style={{ fontFamily: "Inter, sans-serif" }}>Email</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11 w-full border border-white/15 bg-black/40 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#CDB37F]/65"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </label>

                                <label className="sm:col-span-2">
                                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/60" style={{ fontFamily: "Inter, sans-serif" }}>Phone (Optional)</span>
                                    <input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-11 w-full border border-white/15 bg-black/40 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#CDB37F]/65"
                                        placeholder="e.g. 01712345678"
                                    />
                                </label>

                                <label className="sm:col-span-2">
                                    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-white/60" style={{ fontFamily: "Inter, sans-serif" }}>Message</span>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={6}
                                        className="w-full resize-y border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#CDB37F]/65"
                                        placeholder={`Hi ${brandName} team, I would like to...`}
                                        required
                                    />
                                </label>
                            </div>

                            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-white/50" style={{ fontFamily: "Inter, sans-serif" }}>
                                    We typically respond within 24 hours.
                                </p>
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center border-t-[3px] border-l-[3px] border-b border-r border-[#CDB37F] bg-transparent px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#CDB37F] transition-all hover:bg-[#CDB37F] hover:text-black"
                                    style={{ fontFamily: "Inter, sans-serif" }}
                                >
                                    Send Inquiry
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </section>
    )
}
