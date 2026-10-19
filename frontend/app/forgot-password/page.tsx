"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import { Inter, Josefin_Sans, Playfair_Display } from "next/font/google"
import api from "@admin/api/base"
import { useBusiness } from "@/context/BusinessContext"
import { resolveBusinessName } from "@/lib/business-branding"

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] })
const josefin = Josefin_Sans({ subsets: ["latin"], weight: ["600"] })
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"] })

function ForgotPasswordForm() {
    const { businessName } = useBusiness()
    const brandName = resolveBusinessName(businessName)
    const [step, setStep] = useState<"email" | "verify" | "reset">("email")
    const [email, setEmail] = useState("")
    const [code, setCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")
        setLoading(true)
        try {
            await api.post("/auth/send-reset-code", { email })
            setSuccess("Verification code sent to your email")
            setStep("verify")
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to send code. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")
        setLoading(true)
        try {
            await api.post("/auth/verify-reset-code", { email, code })
            setSuccess("Code verified successfully")
            setStep("reset")
        } catch (err: any) {
            setError(err.response?.data?.message || "Invalid verification code. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long")
            return
        }

        setLoading(true)
        try {
            await api.post("/auth/reset-password", { email, code, newPassword })
            setSuccess("Password reset successfully! Redirecting to login...")
            setTimeout(() => {
                window.location.href = "/login"
            }, 2000)
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to reset password. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={`${inter.className} min-h-screen bg-black text-white`}>
            <div className="flex min-h-screen w-full">
                <div
                    className="relative hidden overflow-hidden border-r border-[#eccd80]/25 lg:flex lg:w-[56%]"
                    style={{
                        backgroundImage: "url('/login-cover.avif')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                >
                    <div className="relative flex min-h-screen w-full flex-col justify-between bg-black/56 p-8 xl:p-10">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_34%,rgba(255,255,255,0.16),transparent_46%)]" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/52 to-transparent" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-black/25 to-transparent" />

                        <div className="relative z-10">
                            <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-[#eccd80]/90">
                                Password Recovery
                            </p>
                            <p className={`${josefin.className} text-[32px] font-semibold leading-none text-white`}>
                                {brandName}
                            </p>
                        </div>

                        <div className="relative z-10 flex flex-1 items-center">
                            <div className="max-w-[620px]">
                                <h2 className={`${playfair.className} text-[44px] font-semibold capitalize leading-[1.15] text-white`}>
                                    Reset securely, return with <span className="italic font-normal">confidence.</span>
                                </h2>
                                <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-white/78">
                                    Recover access through a verified OTP flow, set a stronger password, and continue your beauty journey without delay.
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 flex items-end justify-between gap-6">
                            <div className="flex gap-8 text-white/80">
                                <div>
                                    <p className="text-[20px] font-semibold leading-none text-[#eccd80]">Secure</p>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em]">OTP Verified</p>
                                </div>
                                <div>
                                    <p className="text-[20px] font-semibold leading-none text-[#eccd80]">15 Min</p>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em]">Code Expiry</p>
                                </div>
                            </div>

                            <p className="text-right text-[11px] uppercase tracking-[0.2em] text-white/70">
                                {brandName} &mdash; Account Recovery
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative flex w-full items-center justify-center px-6 py-6 sm:px-6 lg:w-[44%] lg:px-8 xl:px-11">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(236,205,128,0.12),transparent_45%)]" />
                    <div className="relative w-full max-w-[480px]">
                        <div className="mb-5">
                            <div className="mb-5 flex items-center gap-3">
                                <Link href="/login" className="flex h-9 w-9 items-center justify-center rounded border border-white/25 text-white/60 transition-colors hover:border-[#eccd80] hover:text-[#eccd80]">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                                <h1 className={`${playfair.className} text-[32px] font-semibold leading-[1.08] text-white sm:text-[36px]`}>
                                    Reset <span className="italic font-normal">Password</span>
                                </h1>
                            </div>
                            <p className="mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-white/82">
                                Verify your email to securely reset your password and regain access to your account.
                            </p>
                            <div className="mt-3 h-px w-full bg-gradient-to-r from-[#eccd80]/70 via-white/20 to-transparent" />
                        </div>

                        {error && (
                            <div className="mb-6 border border-red-400/70 bg-red-500/10 px-4 py-3">
                                <p className="text-sm text-red-200">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 border border-emerald-300/60 bg-emerald-500/10 px-4 py-3">
                                <p className="text-sm font-medium text-emerald-200">{success}</p>
                            </div>
                        )}

                        {step === "email" && (
                            <form onSubmit={handleSendCode} className="space-y-3.5">
                                <div className="space-y-2.5">
                                    <label htmlFor="email" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/90">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="e.g. alex@example.com"
                                        required
                                        autoComplete="email"
                                        className="h-9 w-full border border-[#f2f2f2]/85 bg-transparent px-4 text-[13px] text-white placeholder:text-white/55 outline-none transition-all focus:border-[#eccd80] focus:shadow-[0_0_0_1px_rgba(236,205,128,0.38)]"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex h-9 w-full items-center justify-center bg-white px-8 text-[13px] font-semibold uppercase tracking-[0.1em] text-black transition-all hover:-translate-y-0.5 hover:bg-[#f5f5f5] hover:shadow-[0_24px_50px_-24px_rgba(255,255,255,0.95)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Sending..." : "Send Code"}
                                </button>
                            </form>
                        )}

                        {step === "verify" && (
                            <form onSubmit={handleVerifyCode} className="space-y-3.5">
                                <div className="space-y-2.5">
                                    <label htmlFor="code" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/90">
                                        Verification Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="code"
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="e.g. 123456"
                                        required
                                        className="h-9 w-full border border-[#f2f2f2]/85 bg-transparent px-4 text-[13px] text-white placeholder:text-white/55 outline-none transition-all focus:border-[#eccd80] focus:shadow-[0_0_0_1px_rgba(236,205,128,0.38)]"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex h-9 w-full items-center justify-center bg-white px-8 text-[13px] font-semibold uppercase tracking-[0.1em] text-black transition-all hover:-translate-y-0.5 hover:bg-[#f5f5f5] hover:shadow-[0_24px_50px_-24px_rgba(255,255,255,0.95)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Verifying..." : "Verify Code"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("email")
                                        setCode("")
                                        setError("")
                                    }}
                                    className="text-[13px] text-white/60 transition-colors hover:text-[#eccd80]"
                                >
                                    Change email
                                </button>
                            </form>
                        )}

                        {step === "reset" && (
                            <form onSubmit={handleResetPassword} className="space-y-3.5">
                                <div className="space-y-2.5">
                                    <label htmlFor="newPassword" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/90">
                                        New Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="newPassword"
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="e.g. Maple!River27 (use your own)"
                                            required
                                            className="h-9 w-full border border-[#f2f2f2]/85 bg-transparent px-4 pr-11 text-[13px] text-white placeholder:text-white/55 outline-none transition-all focus:border-[#eccd80] focus:shadow-[0_0_0_1px_rgba(236,205,128,0.38)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((p) => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 transition-colors hover:text-white"
                                            tabIndex={-1}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <label htmlFor="confirmPassword" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/90">
                                        Confirm Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat your new password, e.g. Maple!River27"
                                            required
                                            className="h-9 w-full border border-[#f2f2f2]/85 bg-transparent px-4 pr-11 text-[13px] text-white placeholder:text-white/55 outline-none transition-all focus:border-[#eccd80] focus:shadow-[0_0_0_1px_rgba(236,205,128,0.38)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((p) => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 transition-colors hover:text-white"
                                            tabIndex={-1}
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex h-9 w-full items-center justify-center bg-white px-8 text-[13px] font-semibold uppercase tracking-[0.1em] text-black transition-all hover:-translate-y-0.5 hover:bg-[#f5f5f5] hover:shadow-[0_24px_50px_-24px_rgba(255,255,255,0.95)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </button>
                            </form>
                        )}

                        <div className="mt-5">
                            <Link href="/login" className="text-[13px] text-white/60 underline underline-offset-4 transition-colors hover:text-[#eccd80]">
                                Back to Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ForgotPasswordPage() {
    return (
        <Suspense>
            <ForgotPasswordForm />
        </Suspense>
    )
}
