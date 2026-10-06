"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Check } from "lucide-react"
import { AccountShell, accountStyles as styles } from "@/components/account-shell"
import api from "@admin/api/base"

function getUserFromToken(token: string): { name?: string; email?: string; role?: string } | null {
    try {
        const payload = token.split('.')[1]
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
        return { name: decoded.name, email: decoded.useremail, role: decoded.role }
    } catch {
        return null
    }
}

function persistToken(token: string) {
    localStorage.setItem("accessToken", token)
    const maxAge = 10 * 24 * 60 * 60
    document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=strict`
}

export default function AccountSettingsPage() {
    const router = useRouter()
    const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)

    // Profile
    const [profileName, setProfileName] = useState("")
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileError, setProfileError] = useState("")
    const [profileSuccess, setProfileSuccess] = useState(false)

    // Password
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showOld, setShowOld] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordError, setPasswordError] = useState("")
    const [passwordSuccess, setPasswordSuccess] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem("accessToken")
        if (!token) { router.replace("/login"); return }
        const decoded = getUserFromToken(token)
        if (!decoded) { router.replace("/login"); return }
        setUser(decoded)
        setProfileName(decoded.name || "")
    }, [router])

    const handleSaveName = async () => {
        if (!profileName.trim()) { setProfileError("Name cannot be empty"); return }
        setProfileSaving(true)
        setProfileError("")
        setProfileSuccess(false)
        try {
            const { data } = await (api as any).patch("/auth/update-profile", { name: profileName.trim() }, { cache: false })
            persistToken(data.accessToken)
            const updated = getUserFromToken(data.accessToken)
            setUser(updated)
            setProfileName(updated?.name || "")
            setProfileSuccess(true)
        } catch (err: any) {
            setProfileError(err?.response?.data?.message || "Failed to update name")
        } finally {
            setProfileSaving(false)
        }
    }

    const handleSavePassword = async () => {
        setPasswordError("")
        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordError("Please fill in all fields")
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords don't match")
            return
        }
        if (newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters")
            return
        }
        setPasswordSaving(true)
        setPasswordSuccess(false)
        try {
            await (api as any).patch("/auth/update-password", { oldPassword, newPassword }, { cache: false })
            setOldPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setPasswordSuccess(true)
        } catch (err: any) {
            setPasswordError(err?.response?.data?.message || "Incorrect current password")
        } finally {
            setPasswordSaving(false)
        }
    }

    if (!user) return null

    return (
        <AccountShell>
            <section className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>My account</p>
                    <h1>
                        Account <span>settings</span>
                    </h1>
                    <p>{user.email}</p>
                </div>
            </section>

            <div className={styles.stack}>
                <section className={styles.card}>
                    <h2>Profile</h2>
                    <p className={styles.hint}>Update the name we use when we greet you.</p>
                    <div className={styles.field}>
                        <label htmlFor="display-name">Display name</label>
                        <input
                            id="display-name"
                            value={profileName}
                            onChange={(e) => {
                                setProfileName(e.target.value)
                                setProfileError("")
                                setProfileSuccess(false)
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName() }}
                            placeholder="e.g. Alex Rahman"
                        />
                        {profileError && <p className={styles.error}>{profileError}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={profileSaving || !profileName.trim()}
                            className={styles.primaryButton}
                        >
                            {profileSaving && <Loader2 size={14} className="animate-spin" />}
                            {profileSuccess && !profileSaving && <Check size={14} />}
                            {profileSuccess ? "Saved" : "Save name"}
                        </button>
                        {profileSuccess && <p className={styles.success}>Name updated successfully</p>}
                    </div>
                </section>

                <section className={styles.card}>
                    <h2>Password</h2>
                    <p className={styles.hint}>Choose a new password for this account.</p>
                    <div className={styles.field}>
                        <label htmlFor="current-password">Current password</label>
                        <div className={styles.passwordWrap}>
                            <input
                                id="current-password"
                                type={showOld ? "text" : "password"}
                                value={oldPassword}
                                onChange={(e) => { setOldPassword(e.target.value); setPasswordError(""); setPasswordSuccess(false) }}
                                placeholder="e.g. Maple!River27 (use your own)"
                            />
                            <button type="button" onClick={() => setShowOld((v) => !v)} aria-label={showOld ? "Hide password" : "Show password"}>
                                {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="new-password">New password</label>
                        <div className={styles.passwordWrap}>
                            <input
                                id="new-password"
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); setPasswordSuccess(false) }}
                                placeholder="e.g. Maple!River27 (use your own)"
                            />
                            <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "Hide password" : "Show password"}>
                                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="confirm-password">Confirm new password</label>
                        <div className={styles.passwordWrap}>
                            <input
                                id="confirm-password"
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); setPasswordSuccess(false) }}
                                placeholder="Repeat your new password, e.g. Maple!River27"
                            />
                            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                            <p className={styles.error}>Passwords don&apos;t match</p>
                        )}
                    </div>
                    {passwordError && <p className={styles.error}>{passwordError}</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                            type="button"
                            onClick={handleSavePassword}
                            disabled={
                                passwordSaving ||
                                !oldPassword ||
                                !newPassword ||
                                !confirmPassword ||
                                newPassword !== confirmPassword
                            }
                            className={styles.primaryButton}
                        >
                            {passwordSaving && <Loader2 size={14} className="animate-spin" />}
                            {passwordSuccess && !passwordSaving && <Check size={14} />}
                            {passwordSuccess ? "Updated" : "Update password"}
                        </button>
                        {passwordSuccess && <p className={styles.success}>Password updated successfully</p>}
                    </div>
                </section>
            </div>
        </AccountShell>
    )
}
