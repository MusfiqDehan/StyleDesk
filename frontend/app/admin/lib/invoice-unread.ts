/** Shared unread-invoice IDs for the sidebar badge + NEW mark on Invoice. */

export const UNREAD_INVOICES_KEY = "admin_invoice_unread_ids"
export const UNREAD_INVOICES_EVENT = "invoice-unread-changed"
const UNREAD_INVOICES_MAX = 200

function emitChanged(id: string, unread: boolean) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(UNREAD_INVOICES_EVENT, { detail: { id, unread } }),
  )
}

export function loadUnreadInvoiceIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(UNREAD_INVOICES_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((id) => String(id)).filter(Boolean))
  } catch {
    return new Set()
  }
}

export function persistUnreadInvoiceIds(ids: Set<string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      UNREAD_INVOICES_KEY,
      JSON.stringify([...ids].slice(0, UNREAD_INVOICES_MAX)),
    )
  } catch {
    /* ignore quota / private mode */
  }
}

export function markInvoiceUnread(id: string): Set<string> {
  const next = loadUnreadInvoiceIds()
  const invoiceId = String(id || "").trim()
  if (!invoiceId || next.has(invoiceId)) return next
  next.add(invoiceId)
  persistUnreadInvoiceIds(next)
  emitChanged(invoiceId, true)
  return next
}

export function markInvoiceRead(id: string): Set<string> {
  const next = loadUnreadInvoiceIds()
  const invoiceId = String(id || "").trim()
  if (!invoiceId || !next.has(invoiceId)) return next
  next.delete(invoiceId)
  persistUnreadInvoiceIds(next)
  emitChanged(invoiceId, false)
  return next
}

/** Drop unread IDs that no longer exist so the sidebar count cannot stick forever. */
export function pruneUnreadInvoiceIds(existingIds: Iterable<string>): Set<string> {
  const existing = new Set(
    [...existingIds].map((id) => String(id || "").trim()).filter(Boolean),
  )
  const prev = loadUnreadInvoiceIds()
  const next = new Set<string>()
  for (const id of prev) {
    if (existing.has(id)) next.add(id)
  }
  if (next.size !== prev.size) {
    persistUnreadInvoiceIds(next)
    emitChanged("", false)
  }
  return next
}
