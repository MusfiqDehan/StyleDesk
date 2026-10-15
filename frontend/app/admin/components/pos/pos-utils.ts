export function formatTk(value: number, showZeroAsDouble = false) {
  const amount = Number(value) || 0
  if (showZeroAsDouble && amount === 0) return "Tk.00"
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`
}

export function formatPayButtonAmount(value: number) {
  const amount = Math.round(Number(value) || 0)
  return `Pay (TK.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)})`
}

/** Hardcoded POS order-taker roles from login (admin / manager / staff). */
export type PosOrderTakerRole = "Admin" | "Manager" | "Staff" | "Customer"

export function getPosOrderTakerRole(
  role: "admin" | "storeManager" | "staff" | "stylist" | "custom" | "customer" | "superadmin" | undefined | null,
): PosOrderTakerRole {
  if (role === "customer") return "Customer"
  if (role === "admin" || role === "superadmin") return "Admin"
  if (role === "storeManager") return "Manager"
  return "Staff"
}

/** Role + display name so multiple staff accounts are distinguishable. */
export function getPosOrderTakerDisplay(user: {
  role?: "admin" | "storeManager" | "staff" | "stylist" | "custom" | "customer" | "superadmin" | null
  name?: string | null
  employeeName?: string | null
  useremail?: string | null
} | null | undefined): string {
  const roleLabel = getPosOrderTakerRole(user?.role)
  const fromProfile = user?.name?.trim() || user?.employeeName?.trim() || ""
  const fromEmail =
    user?.useremail
      ?.split("@")[0]
      ?.replace(/[._+\-]+/g, " ")
      ?.replace(/\s+/g, " ")
      ?.trim() || ""
  const name = fromProfile || fromEmail
  if (!name) return roleLabel
  const displayName = fromProfile
    ? fromProfile
    : name.replace(/\b\w/g, (c) => c.toUpperCase())
  return `${displayName} (${roleLabel})`
}

export type PosVisitType = "walk-in" | "online"

export interface PosCustomer {
  id: string
  name: string
  phone: string
  points?: number
  discountPercent?: number
}

export function normalizePosPhone(value: string) {
  return value.replace(/\D/g, "")
}

/** Bangladeshi phone: 01[3-9]XXXXXXXX or +8801[3-9]XXXXXXXX */
export function isValidBangladeshiPhone(phone: string) {
  const normalized = normalizePosPhone(phone)
  return /^(?:88)?01[3-9]\d{8}$/.test(normalized)
}
