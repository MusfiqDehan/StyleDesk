/** User-facing label; stored DB enum value remains "Stylist". */
export const EMPLOYEE_ROLE_ARTIST = "Artist"

export const STORED_EMPLOYEE_ROLE_STYLIST = "Stylist"

export function isArtistEmployeeRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "").trim().toLowerCase()
  return normalized === "artist" || normalized === "stylist"
}

/** User-facing label for an employee role value. */
export function formatEmployeeRoleLabel(role: string | null | undefined): string {
  if (isArtistEmployeeRole(role)) return EMPLOYEE_ROLE_ARTIST
  return (role ?? "").trim() || "Other"
}

/** Auth / system role slug label (e.g. stylist login role). */
export function formatAuthRoleLabel(role: string | null | undefined): string {
  if (role === "stylist") return EMPLOYEE_ROLE_ARTIST
  if (role === "storeManager") return "Manager"
  if (role === "staff") return "Staff"
  if (role === "admin") return "Admin"
  if (role === "custom") return "Custom"
  return role ?? ""
}
