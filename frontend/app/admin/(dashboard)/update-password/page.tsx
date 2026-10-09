"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Lock, ShieldCheck, Loader2, User, Phone } from "lucide-react"
import { toast } from '@/lib/toast'
import { updatePassword } from "@admin/api/update-password/update-password"
import { getMyProfile, updateMyProfile } from "@admin/api/update-password/update-profile"
import { AdminPageHeader } from "@admin/components/admin-page-header"

const isValidBdPhone = (phone: string) =>
  /^(?:(?:\+?88)?01[3-9]\d{8}|1[3-9]\d{8})$/.test(phone.trim())

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyProfile()
        if (cancelled) return
        setProfile({
          name: me.name || me.clientName || "",
          phone: me.phone || "",
        })
      } catch {
        // Non-blocking — password form still works
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistToken = (token: string) => {
    localStorage.setItem("accessToken", token)
    const maxAge = 10 * 24 * 60 * 60
    document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=strict`
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = profile.name.trim()
    const phone = profile.phone.trim()

    if (!name) {
      toast.error("Full name is required")
      return
    }
    if (!phone) {
      toast.error("Phone number is required")
      return
    }
    if (!isValidBdPhone(phone)) {
      toast.error("Enter a valid Bangladeshi phone number (01XXXXXXXXX)")
      return
    }

    setSavingProfile(true)
    try {
      const data = await updateMyProfile({ name, phone })
      if (data.accessToken) persistToken(data.accessToken)
      if (data.phone) localStorage.setItem("userPhone", data.phone)
      setProfile({
        name: data.name || name,
        phone: data.phone || phone,
      })
      toast.success("Profile updated successfully")
    } catch (error: any) {
      const message = error.response?.data?.message
      toast.error(
        Array.isArray(message) ? message[0] : message || "Failed to update profile",
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New passwords do not match with the confirm password")
      return
    }

    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }

    setLoading(true)
    try {
      await updatePassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      })
      toast.success("Password updated successfully")
      setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" })
    } catch (error: any) {
      console.error(error)
      const message = error.response?.data?.message || "Failed to update password"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={DASH_PAGE}>
      <div className="mx-auto w-full max-w-4xl">
        <AdminPageHeader
          title="Profile & Security"
          subtitle="Update your contact details and password"
        />

        <div className="space-y-5">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">My Profile</h3>
              <p className="text-xs text-muted-foreground">
                Full name and phone used for online bookings
              </p>
            </div>
          </div>

          {profileLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative mt-1">
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="e.g. Alex Rahman"
                    className="pl-9"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative mt-1">
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    maxLength={14}
                    placeholder="e.g. 01712345678"
                    className="pl-9"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    required
                  />
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
              </div>

              <div className="pt-1">
                <Button type="submit" disabled={savingProfile} accessAction="edit">
                  {savingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">Update Password</h3>
              <p className="text-xs text-muted-foreground">
                Enter your current password then choose a new one
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="oldPassword">Current Password</Label>
              <div className="relative mt-1">
                <Input
                  id="oldPassword"
                  type="password"
                  placeholder="e.g. Maple!River27 (use your own)"
                  className="pl-9"
                  value={formData.oldPassword}
                  onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                  required
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              </div>
            </div>

            <div className="pt-1 space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="e.g. Maple!River27 (use your own)"
                    className="pl-9"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    required
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="e.g. Maple!River27 (use your own)"
                    className="pl-9"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={loading} accessAction="edit">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}
