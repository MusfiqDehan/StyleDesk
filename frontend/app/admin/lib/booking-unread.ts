/** Shared unread-booking IDs for the NEW badge on /admin/bookings. */

export const UNREAD_BOOKINGS_KEY = "admin_booking_unread_ids"
export const UNREAD_BOOKINGS_EVENT = "booking-unread-changed"
const UNREAD_BOOKINGS_MAX = 200

function emitChanged(id: string, unread: boolean) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(UNREAD_BOOKINGS_EVENT, { detail: { id, unread } }),
  )
}

export function loadUnreadBookingIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(UNREAD_BOOKINGS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((id) => String(id)).filter(Boolean))
  } catch {
    return new Set()
  }
}

export function persistUnreadBookingIds(ids: Set<string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      UNREAD_BOOKINGS_KEY,
      JSON.stringify([...ids].slice(0, UNREAD_BOOKINGS_MAX)),
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function markBookingUnread(id: string): Set<string> {
  const next = loadUnreadBookingIds()
  const bookingId = String(id || "").trim()
  if (!bookingId || next.has(bookingId)) return next
  next.add(bookingId)
  persistUnreadBookingIds(next)
  emitChanged(bookingId, true)
  return next
}

export function markBookingRead(id: string): Set<string> {
  const next = loadUnreadBookingIds()
  const bookingId = String(id || "").trim()
  if (!bookingId || !next.has(bookingId)) return next
  next.delete(bookingId)
  persistUnreadBookingIds(next)
  emitChanged(bookingId, false)
  return next
}

/** Drop unread IDs that no longer exist so the sidebar count cannot stick forever. */
export function pruneUnreadBookingIds(existingIds: Iterable<string>): Set<string> {
  const existing = new Set(
    [...existingIds].map((id) => String(id || "").trim()).filter(Boolean),
  )
  const prev = loadUnreadBookingIds()
  const next = new Set<string>()
  for (const id of prev) {
    if (existing.has(id)) next.add(id)
  }
  if (next.size !== prev.size) {
    persistUnreadBookingIds(next)
    emitChanged("", false)
  }
  return next
}
