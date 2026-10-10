import { getCursorCollection } from "@/lib/pagination/collection"
const invoiceEndpoint=()=>typeof window!=='undefined'&&window.location.pathname.startsWith('/admin/pos')?'/pos/invoices':'/invoice'
import api from '../base'
import { CACHE, consumeStale, markStale, removeFromCache } from '@admin/lib/cache'

const TTL = 2 * 60 * 1000 // 2 min — invoices/transactions are high-frequency

export async function getInvoices(
  page = 1,
  limit = 20,
  noCache = false,
  filters?: { date?: string; month?: number; year?: number },
) {
  if (limit >= 100) return getCursorCollection(invoiceEndpoint(), filters ?? {})
  const override = noCache || consumeStale(CACHE.BILLING)
  const params = {
    page,
    limit,
    ...(filters?.date ? { date: filters.date } : {}),
    ...(filters?.month ? { month: filters.month } : {}),
    ...(filters?.year ? { year: filters.year } : {}),
  }
  const { data } = await api.get(invoiceEndpoint(), {
    id: `${CACHE.BILLING}:${JSON.stringify(params)}`,
    params,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data
}

export async function createInvoice(payload: {
  clientId?: string
  appointmentId?: string
  services?: string[]
  packageNames?: string[]
  source?: 'online' | 'offline'
  staff?: string
  assistant?: string
  printBy?: string
  paidAmount?: number
  total?: number
  paymentMethod?: 'Cash' | 'bKash' | 'Nagad' | 'Bank' | 'Card'
  status?: 'Paid' | 'Due' | 'Partial' | 'Unpaid'
  confirmedAt?: string
  applyCommission?: boolean
  /** When true, `total` is final (tax/discount already applied) — do not apply settings tax again */
  skipTax?: boolean
  /** Tax % frozen on the invoice at create time */
  taxRate?: number
  /** Discount amount (currency) frozen on the invoice at create time */
  discount?: number
  /** Prior customer due collected on this invoice (POS) */
  dueCollected?: number
  /** Snapshot of outstanding due when collection was added */
  priorDueSnapshot?: number
}) {
  const { data } = await api.post(invoiceEndpoint(), payload)
  // Invoice money feeds Income & Expense — drop finance cache immediately
  markStale(CACHE.BILLING, CACHE.DASHBOARD, CACHE.CLIENTS, CACHE.FINANCE)
  return data
}

export async function updateInvoice(id: string, payload: {
  status?: string
  paymentMethod?: string
  paidAmount?: number | null
  applyCommission?: boolean
  [key: string]: unknown
}) {
  const { data } = await api.patch(`${invoiceEndpoint()}/${id}`, payload)
  markStale(CACHE.BILLING, CACHE.DASHBOARD, CACHE.CLIENTS, CACHE.FINANCE)
  return data
}

export async function deleteInvoice(id: string) {
  const { data } = await api.delete(`${invoiceEndpoint()}/${id}`)
  markStale(CACHE.BILLING, CACHE.DASHBOARD, CACHE.FINANCE)
  removeFromCache(CACHE.APPOINTMENTS)
  return data
}
