"use client"

import { useBusiness } from "@/context/BusinessContext"
import { resolveBusinessName } from "@/lib/business-branding"
import Link from "next/link"
import { useState } from "react"
import { toast } from '@/lib/toast'

const socials = [
    {
        label: "Facebook",
        href: "#",
        icon: (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
            </svg>
        ),
    },
    {
        label: "Instagram",
        href: "#",
        icon: (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01" />
            </svg>
        ),
    },
    {
        label: "TikTok",
        href: "#",
        icon: (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
            </svg>
        ),
    },
]

export function Footer() {
    const { businessInfo } = useBusiness()
    const brandName = resolveBusinessName(businessInfo?.businessName)
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsLoading(true)
        try {
            const response = await fetch(`${"/api/backend"}/news-letter-subscriber`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || "Failed to subscribe")
            }

            toast.success("Successfully subscribed to our newsletter!")
            setEmail("")
        } catch (error: any) {
            console.error("Newsletter subscription error:", error)
            toast.error(error.message || "Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <footer className="bg-[#000000] border-t border-white/5">
            <div className="mx-auto w-full max-w-7xl px-6 pt-14 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-8 lg:px-10 lg:pt-20 lg:pb-14">
                <div className="grid gap-10 md:grid-cols-[0.9fr_0.9fr_1.8fr] lg:gap-14 lg:grid-cols-[1.5fr_0.8fr_1fr_1.7fr]">

                    {/* Column 1: Brand */}
                    <div className="flex flex-col items-center text-center md:col-span-3 lg:col-span-1 lg:items-start lg:text-left">
                        <span
                            className="block mb-4 text-2xl font-bold text-white tracking-normal"
                            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                        >
                            {(() => {
                                const name = brandName
                                return <><span style={{ color: '#d4a017' }}>{name.charAt(0)}</span>{name.slice(1)}</>
                            })()}
                        </span>
                        <p
                            className="mb-5 max-w-sm text-[13px] leading-relaxed text-gray-400"
                            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                        >
                            Where luxury meets artistry. Experience the finest in beauty and wellness, crafted for the modern connoisseur.
                        </p>
                        {/* Social icons */}
                        <div className="flex gap-3">
                            {socials.map((s) => (
                                <a
                                    key={s.label}
                                    href={s.href}
                                    aria-label={s.label}
                                    className="flex h-10 w-10 items-center justify-center border border-white/20 text-gray-400 rounded-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d4a017]/70 hover:text-[#d4a017] hover:bg-[#d4a017]/8 hover:shadow-[0_4px_12px_rgba(212,160,23,0.2)]"
                                >
                                    {s.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Columns 2 & 3: side-by-side on mobile, individual cells on desktop */}
                    <div className="grid grid-cols-2 gap-6 md:col-span-2 lg:contents">

                        {/* Column 2: Explore Us */}
                        <div>
                            <p className="mb-4 text-[15px] lg:text-[18px] font-semibold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Explore Us
                            </p>
                            <ul className="space-y-3">
                                {[
                                    { name: "SERVICES", href: "/services" },
                                    { name: "PACKAGES", href: "/packages" },
                                    { name: "ABOUT US", href: "/about" },
                                ].map((item) => (
                                    <li key={item.name}>
                                        <Link
                                            href={item.href}
                                            className="text-[11px] font-bold text-gray-400 uppercase tracking-widest transition-colors duration-300 hover:text-white"
                                            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                                        >
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Column 3: Contact Us */}
                        <div>
                            <p className="mb-4 text-[15px] lg:text-[18px] font-semibold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Contact Us
                            </p>
                            <ul className="space-y-3 text-[12px] text-gray-400 leading-relaxed" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                                <li>{businessInfo?.address || "Mirpur DOHS, Pallabi, Dhaka 1216, Bangladesh."}</li>
                                <li>{businessInfo?.phone || "+880 0000000000"}</li>
                                <li>{businessInfo?.email || "admin@admin.com"}</li>
                            </ul>
                        </div>

                    </div>

                    {/* Column 4: Newsletter */}
                    <div>
                        <p className="mb-4 text-[15px] lg:text-[18px] font-semibold text-white text-center md:text-left" style={{ fontFamily: 'Playfair Display, serif' }}>
                            Subscribe To Newsletter
                        </p>
                        <p className="mb-4 text-[12px] leading-relaxed text-gray-400 text-center md:text-left" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                            Get monthly beauty insights, salon trends, and real-world experiences from leading salons and beauty experts around the globe.
                        </p>
                        <form onSubmit={handleSubscribe} className="flex border border-white/20 bg-transparent w-full">
                            <input
                                type="email"
                                placeholder="e.g. alex@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-grow bg-transparent px-3 py-2.5 text-[12px] text-white placeholder-gray-500 focus:outline-none min-w-0"
                                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                                required
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="bg-white px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-black transition-colors duration-300 hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed shrink-0"
                                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                            >
                                {isLoading ? "..." : "SUBSCRIBE"}
                            </button>
                        </form>
                    </div>

                </div>

                {/* Divider */}
                <div className="border-t border-white/10 mt-10 lg:mt-20 mb-6 lg:mb-8" />

                {/* Bottom Bar */}
                <div className="flex flex-col items-center text-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:text-left">
                    <p className="text-[11px] text-gray-500" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                        © 2026 {brandName} All Rights Reserved.{" "}
                        <span className="block sm:inline">Developed by <a href="https://www.geekssort.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline">GeekSSort</a></span>
                    </p>
                    <div className="flex gap-6 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <Link href="/" className="hover:text-white transition-colors" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>TERMS</Link>
                        <Link href="/" className="hover:text-white transition-colors" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>PRIVACY POLICY</Link>
                    </div>
                </div>

            </div>
        </footer>
    )
}
