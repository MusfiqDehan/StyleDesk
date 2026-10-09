import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base'
import { CACHE, consumeStale, markStale, removeFromCache } from '@admin/lib/cache'

const TTL = 60 * 1000 // 1 min — appointments change very frequently

export async function getAppointments(filters?: {
  date?: string
  source?: string
  status?: string
  phone?: string
  page?: number
  limit?: number
  staff?: string
}, noCache = false) {
  if (!filters?.limit || filters.limit >= 100) return getCursorCollection('/appointments', filters ?? {})
  const override = noCache || consumeStale(CACHE.APPOINTMENTS)
  // Unique cache id per filter set — shared id caused Online-only responses to hide other bookings
  const cacheId = filters
    ? `${CACHE.APPOINTMENTS}:${JSON.stringify(filters)}`
    : CACHE.APPOINTMENTS
  const { data } = await api.get('/appointments', {
    id: cacheId,
    params: filters,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data
}

export async function createAppointment(payload: {
  clientName: string
  phoneNumber: string
  date: string
  time: string
  staff?: string
  assistant?: string
  source?: string
  services?: string[]
  notes?: string
  status?: string
  isPackage?: boolean
  packageName?: string
  applyCommission?: boolean
  advance?: number
  discount?: number
  dueAmount?: number
  totalAmount?: number
  inTime?: string
  outTime?: string
}) {
  const { data } = await api.post('/appointments', payload)
  // Backend auto-creates the client inside the same transaction — invalidate clients cache so the page refreshes
  markStale(CACHE.APPOINTMENTS, CACHE.DASHBOARD, CACHE.CLIENTS, CACHE.BILLING, CACHE.FINANCE)
  return data
}

export async function updateAppointment(id: string, payload: object) {
  const { data } = await api.patch(`/appointments/id/${encodeURIComponent(id)}`, payload)
  markStale(CACHE.APPOINTMENTS, CACHE.DASHBOARD, CACHE.BILLING, CACHE.CLIENTS, CACHE.PAYROLL, CACHE.FINANCE)
  return data
}

export async function deleteAppointment(id: string) {
  const { data } = await api.delete(`/appointments/${id}`)
  markStale(CACHE.APPOINTMENTS, CACHE.DASHBOARD, CACHE.BILLING, CACHE.CLIENTS, CACHE.FINANCE)
  return data
}
