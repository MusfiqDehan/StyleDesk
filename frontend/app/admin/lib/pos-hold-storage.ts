import type { PosCartItem } from "@admin/components/pos/pos-selected-services-panel"
import type { PosDiscountType } from "@admin/components/pos/pos-discount-modal"
import type { PosPaymentMethod } from "@admin/components/pos/pos-select-payment"
import type { PosCustomer, PosVisitType } from "@admin/components/pos/pos-utils"

export interface PosHeldTransaction {
  id: string
  heldAt: string
  items: PosCartItem[]
  customer: PosCustomer | null
  visitType: PosVisitType
  taxRate: number
  discountType: PosDiscountType
  discountValue: number
  paymentMethod: PosPaymentMethod
}

const STORAGE_KEY = "makeover-pos-held-transactions"
const MAX_HELD = 30

function isCartItem(value: unknown): value is PosCartItem {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.price === "number" &&
    Number.isFinite(row.price) &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity > 0 &&
    (row.type === "service" || row.type === "package")
  )
}

function isHeldTransaction(value: unknown): value is PosHeldTransaction {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || typeof row.heldAt !== "string") return false
  if (!Array.isArray(row.items) || !row.items.every(isCartItem)) return false
  if (row.customer != null) {
    const c = row.customer as Record<string, unknown>
    if (typeof c.id !== "string" || typeof c.name !== "string" || typeof c.phone !== "string") {
      return false
    }
  }
  if (row.visitType !== "walk-in" && row.visitType !== "online") return false
  if (typeof row.taxRate !== "number" || !Number.isFinite(row.taxRate)) return false
  if (row.discountType !== "percentage" && row.discountType !== "flat") return false
  if (typeof row.discountValue !== "number" || !Number.isFinite(row.discountValue)) return false
  if (row.paymentMethod !== "cash" && row.paymentMethod !== "online") return false
  return true
}

export function loadHeldTransactions(): PosHeldTransaction[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHeldTransaction)
  } catch {
    return []
  }
}

function persistHeld(transactions: PosHeldTransaction[]) {
  if (typeof window === "undefined") return
  try {
    if (transactions.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  } catch {
    // ignore quota / private mode
  }
}

export function addHeldTransaction(
  snapshot: Omit<PosHeldTransaction, "id" | "heldAt">,
): PosHeldTransaction {
  const held: PosHeldTransaction = {
    ...snapshot,
    id: `hold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    heldAt: new Date().toISOString(),
    items: snapshot.items.map((item) => ({ ...item })),
    customer: snapshot.customer ? { ...snapshot.customer } : null,
  }
  const existing = loadHeldTransactions()
  const next = [held, ...existing].slice(0, MAX_HELD)
  persistHeld(next)
  return held
}

export function removeHeldTransaction(id: string) {
  const next = loadHeldTransactions().filter((row) => row.id !== id)
  persistHeld(next)
}

export function clearAllHeldTransactions() {
  persistHeld([])
}

export function computeHeldTotal(hold: PosHeldTransaction): number {
  const subTotal = hold.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount =
    hold.discountType === "flat"
      ? Math.min(subTotal, Math.round(hold.discountValue || 0))
      : Math.round((subTotal * (hold.discountValue || 0)) / 100)
  const taxable = Math.max(0, subTotal - discount)
  const tax = Math.ceil((taxable * hold.taxRate) / 100)
  return taxable + tax
}
