"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Menu, X, UserCircle, History, LogOut, Settings } from "lucide-react"
import { useBusiness } from "@/context/BusinessContext"
import { getMediaUrl } from "@/lib/utils"
import { resolveBusinessName } from "@/lib/business-branding"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { CartIconButton } from "@/components/cart-drawer"
import { signOut } from "@/lib/auth-redirect"

const navItems = [
    { label: "SERVICES", href: "/services" },
    { label: "PACKAGES", href: "/packages" },
    { label: "ABOUT US", href: "/about-us" },
    { label: "CONTACT US", href: "/contact" },
]

function getUserFromToken(token: string): { name?: string; email?: string; role?: string } | null {
    try {
        const payload = token.split('.')[1]
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
        return { name: decoded.clientName || decoded.employeeName || decoded.name, email: decoded.useremail, role: decoded.role }
    } catch {
        return null
    }
}

function getDashboardLink(role?: string): { label: string; href: string } | null {
    if (!role || role === 'customer') return null
    if (role === 'stylist') return { label: 'Artist Dashboard', href: '/admin/stylist' }
    if (role === 'storeManager') return { label: 'Manager Dashboard', href: '/admin/manager' }
    if (role === 'staff') return { label: 'Staff Dashboard', href: '/admin/staff' }
    return { label: 'Admin Dashboard', href: '/admin' }
}

export function SiteHeader({ solid = false }: { solid?: boolean }) {
    const { businessName, businessInfo } = useBusiness()
    const brandName = resolveBusinessName(businessName)
    const logoUrl = businessInfo?.logoUrl ? getMediaUrl(businessInfo.logoUrl) : null
    const [mobileOpen, setMobileOpen] = useState(false)
    const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const mobileDropdownRef = useRef<HTMLDivElement>(null)
    const pathname = usePathname()

    useEffect(() => {
        const token = localStorage.getItem('accessToken')
        if (token) setUser(getUserFromToken(token))
    }, [])

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            const inDesktop = dropdownRef.current?.contains(target)
            const inMobile = mobileDropdownRef.current?.contains(target)
            if (!inDesktop && !inMobile) setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleLogout = () => signOut('/')

    const isCustomer = !user?.role || user.role === 'customer'
    const dashboardLink = getDashboardLink(user?.role)

    return (
        <>
            {/* ── Mobile left drawer ── */}
            <div className={`fixed inset-0 z-[200] lg:hidden transition-all duration-300 ${mobileOpen ? 'visible' : 'invisible pointer-events-none'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setMobileOpen(false)}
                />
                {/* Drawer panel */}
                <div className={`absolute left-0 top-0 h-full w-[72vw] max-w-[300px] bg-[#0b0b0b] flex flex-col transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* Gold right-edge accent */}
                    <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#eccd80]/30 to-transparent" />

                    {/* Drawer header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                            {logoUrl && (
                                <Image
                                    src={logoUrl}
                                    alt={businessName || "Logo"}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 object-contain shrink-0 brightness-0 invert"
                                    unoptimized
                                />
                            )}
                            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '20px', fontWeight: 700 }} className="text-white">
                                {(() => {
                                    const name = brandName
                                    return <><span style={{ color: '#d4a017' }}>{name.charAt(0)}</span>{name.slice(1)}</>
                                })()}
                            </span>
                        </Link>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center justify-center h-8 w-8 text-white/50 hover:text-white transition-colors"
                            aria-label="Close menu"
                        >
                            <X size={18} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Nav links */}
                    <nav className="flex flex-col gap-1 px-3 py-6 flex-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[11px] uppercase tracking-[0.3em] transition-all duration-200 ${isActive
                                        ? 'bg-[#eccd80]/10 text-[#eccd80]'
                                        : 'text-white/65 hover:bg-white/6 hover:text-white'
                                        }`}
                                    style={{ fontFamily: 'Inter, sans-serif' }}
                                >
                                    {isActive && <span className="h-1 w-1 rounded-full bg-[#eccd80] flex-shrink-0" />}
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Bottom: gold divider + branding */}
                    <div className="px-6 py-5 border-t border-white/8">
                        <p className="text-[9px] uppercase tracking-[0.35em] text-white/20" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Premium Beauty Experience
                        </p>
                    </div>
                </div>
            </div>

            <header
                className={`fixed top-0 left-0 right-0 lg:sticky lg:left-auto lg:right-auto z-50 transition-all duration-300 ${solid
                    ? "bg-[#0b0b0b] border-b border-white/10"
                    : scrolled
                        ? "bg-[#0b0b0b]/95 backdrop-blur-md border-b border-[#eccd80]/40 lg:bg-transparent lg:backdrop-blur-none lg:border-white/8"
                        : "bg-transparent border-b border-white/8"
                    }`}
            >
                {/* ── Mobile header row ── */}
                <div className="flex lg:hidden h-16 w-full items-center justify-between px-4">
                    {/* Left: hamburger */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen((o) => !o)}
                        className="flex items-center justify-center p-1 text-white/65 hover:text-white transition-colors duration-200"
                        aria-label="Toggle menu"
                    >
                        <Menu size={22} strokeWidth={1.5} />
                    </button>

                    {/* Center: logo */}
                    <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                        {logoUrl && (
                            <Image
                                src={logoUrl}
                                alt={businessName || "Logo"}
                                width={30}
                                height={30}
                                className="h-[30px] w-[30px] object-contain shrink-0 brightness-0 invert"
                                unoptimized
                            />
                        )}
                        <span
                            className="text-white"
                            style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '22px', fontWeight: 700 }}
                        >
                            {(() => {
                                const name = brandName
                                return <><span style={{ color: '#d4a017' }}>{name.charAt(0)}</span>{name.slice(1)}</>
                            })()}
                        </span>
                    </Link>

                    {/* Right: cart + user icon or login */}
                    <div className="flex items-center gap-2.5">
                    <CartIconButton className="h-9 w-9" />
                    {user ? (
                        <div className="relative" ref={mobileDropdownRef}>
                            <button
                                onClick={() => setDropdownOpen((o) => !o)}
                                className="group flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] text-white/70 transition-all hover:border-[#eccd80]/65 hover:text-white"
                                aria-label="User menu"
                            >
                                <UserCircle size={18} strokeWidth={1.5} />
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#111111]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(236,205,128,0.22),transparent_45%)] pointer-events-none" />
                                    <div className="relative border-b border-white/10 px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eccd80]/35 bg-[#eccd80]/10 text-[#eccd80]">
                                                <UserCircle size={18} strokeWidth={1.7} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[12px] font-semibold text-white/95">{user.name || 'Guest'}</p>
                                                <p className="mt-0.5 truncate text-[10px] text-white/55">{user.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative p-2">
                                        {isCustomer && (
                                            <Link href="/customer-dashboard" onClick={() => setDropdownOpen(false)} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10.5px] uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors group-hover:border-[#eccd80]/50 group-hover:text-[#eccd80]"><History size={13} strokeWidth={1.7} /></span>
                                                History
                                            </Link>
                                        )}
                                        <Link href="/account-settings" onClick={() => setDropdownOpen(false)} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10.5px] uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors group-hover:border-[#eccd80]/50 group-hover:text-[#eccd80]"><Settings size={13} strokeWidth={1.7} /></span>
                                            Settings
                                        </Link>
                                        {dashboardLink && (
                                            <Link href={dashboardLink.href} onClick={() => setDropdownOpen(false)} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10.5px] uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors group-hover:border-[#eccd80]/50 group-hover:text-[#eccd80]"><UserCircle size={13} strokeWidth={1.7} /></span>
                                                {dashboardLink.label}
                                            </Link>
                                        )}
                                        <button onClick={handleLogout} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[10.5px] uppercase tracking-[0.2em] text-white/55 transition-all duration-200 hover:bg-[#ff4f4f]/10 hover:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-white/70 transition-colors group-hover:border-[#ff6b6b]/45 group-hover:text-[#ff6b6b]"><LogOut size={13} strokeWidth={1.7} /></span>
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" className="text-[10px] font-bold uppercase tracking-widest text-white/80 hover:text-white transition-colors" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                            Login
                        </Link>
                    )}
                    </div>
                </div>

                {/* ── Desktop header row ── */}
                <div className="relative mx-auto hidden lg:flex h-24 w-full max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group min-w-[140px]">
                        {logoUrl && (
                            <Image
                                src={logoUrl}
                                alt={businessName || "Logo"}
                                width={40}
                                height={40}
                                className="h-10 w-10 object-contain shrink-0 transition-opacity duration-300 group-hover:opacity-90 brightness-0 invert"
                                unoptimized
                            />
                        )}
                        <span
                            className="transition-colors duration-300 text-white group-hover:text-white/90"
                            style={{
                                fontFamily: 'var(--font-inter), sans-serif',
                                fontSize: '24px',
                                fontWeight: 700,
                                letterSpacing: 'normal'
                            }}
                        >
                            {(() => {
                                const name = brandName
                                return <><span style={{ color: '#d4a017' }}>{name.charAt(0)}</span>{name.slice(1)}</>
                            })()}
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="flex items-center justify-center gap-9 lg:gap-11">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`relative text-[11px] font-bold uppercase tracking-widest transition-colors duration-200 after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:transition-all after:duration-300 hover:after:w-full ${isActive ? "text-[#eccd80] after:bg-[#eccd80]" : "text-white/90 hover:text-white after:bg-[#eccd80]"}`}
                                    style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Desktop CTA */}
                    <div className="flex min-w-[140px] justify-end items-center gap-3">
                        <CartIconButton />
                        {user ? (
                            <>
                                {dashboardLink && (
                                    <Link
                                        href={dashboardLink.href}
                                        className="inline-flex items-center gap-2 border border-white/25 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white/65 transition-all hover:border-white/50 hover:text-white"
                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                    >
                                        {dashboardLink.label}
                                    </Link>
                                )}


                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setDropdownOpen((o) => !o)}
                                        className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] text-white/70 shadow-[0_4px_18px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#eccd80]/65 hover:bg-white/[0.08] hover:text-white"
                                        aria-label="User menu"
                                    >
                                        <UserCircle size={20} strokeWidth={1.5} className="transition-transform duration-300 group-hover:scale-105" />
                                    </button>
                                    {dropdownOpen && (
                                        <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#111111]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(236,205,128,0.22),transparent_45%)] pointer-events-none" />
                                            <div className="relative border-b border-white/10 px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eccd80]/35 bg-[#eccd80]/10 text-[#eccd80]">
                                                        <UserCircle size={18} strokeWidth={1.7} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[12px] font-semibold text-white/95">{user.name || 'Guest'}</p>
                                                        <p className="mt-0.5 truncate text-[10px] text-white/55">{user.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative p-2">
                                                {isCustomer && (
                                                    <Link
                                                        href="/customer-dashboard"
                                                        onClick={() => setDropdownOpen(false)}
                                                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10.5px] uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
                                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                                    >
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors group-hover:border-[#eccd80]/50 group-hover:text-[#eccd80]">
                                                            <History size={13} strokeWidth={1.7} />
                                                        </span>
                                                        History
                                                    </Link>
                                                )}
                                                <Link
                                                    href="/account-settings"
                                                    onClick={() => setDropdownOpen(false)}
                                                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10.5px] uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
                                                    style={{ fontFamily: 'Inter, sans-serif' }}
                                                >
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors group-hover:border-[#eccd80]/50 group-hover:text-[#eccd80]">
                                                        <Settings size={13} strokeWidth={1.7} />
                                                    </span>
                                                    Settings
                                                </Link>
                                                <button
                                                    onClick={handleLogout}
                                                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[10.5px] uppercase tracking-[0.2em] text-white/55 transition-all duration-200 hover:bg-[#ff4f4f]/10 hover:text-white"
                                                    style={{ fontFamily: 'Inter, sans-serif' }}
                                                >
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-white/70 transition-colors group-hover:border-[#ff6b6b]/45 group-hover:text-[#ff6b6b]">
                                                        <LogOut size={13} strokeWidth={1.7} />
                                                    </span>
                                                    Sign out
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                className="group relative inline-flex items-center justify-center border border-white px-7 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white/10"
                                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                            >
                                <span className="relative">LOGIN</span>
                            </Link>
                        )}
                    </div>

                </div>

            </header>

            {/* Spacer — pushes page content below the fixed mobile header (h-16 = 64px) */}
            <div className="h-16 lg:hidden" aria-hidden="true" />

            {/* ── Mobile bottom navigation bar ── */}
            <MobileBottomNav />
        </>
    )
}
