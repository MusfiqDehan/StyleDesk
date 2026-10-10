import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base'
import { CACHE, consumeStale, markStale } from '@admin/lib/cache'

const TTL = 5 * 60 * 1000 // 5 min

export async function getClients(page = 1, limit = 20, noCache = false) {
  if (limit >= 100) return getCursorCollection('/clients')
  const override = noCache || consumeStale(CACHE.CLIENTS)
  const { data } = await api.get('/clients', {
    id: `${CACHE.CLIENTS}:${page}:${limit}`,
    params: { page, limit },
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data
}

export async function getClientByPhone(phone: string) {
  const { data } = await api.get(`/clients/${phone}`, { cache: false })
  return data
}

export async function createClient(payload: {
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
}) {
  const { data } = await api.post('/clients', payload)
  markStale(CACHE.CLIENTS, CACHE.DASHBOARD)
  return data
}

export async function updateClient(id: string, payload: object) {
  const { data } = await api.patch(`/clients/${id}`, payload)
  markStale(CACHE.CLIENTS, CACHE.APPOINTMENTS, CACHE.BILLING, CACHE.DASHBOARD)
  return data
}

export async function deleteClient(id: string) {
  const { data } = await api.delete(`/clients/${id}`)
  markStale(CACHE.CLIENTS, CACHE.DASHBOARD)
  return data
}

export async function getClientHistory(id: string, noCache = false) {
  try {
    const result = await getCursorCollection(`/clients/history/${encodeURIComponent(id)}`, { collection: 'appointments' })
    return { ...result, appointments: result.data }

  } catch (error: any) {
    if (error?.response?.status !== 404) {
      throw error
    }

    const res = await getClients(1, 1000, noCache)
    const clients = res.data ?? res
    const client = Array.isArray(clients)
      ? clients.find((item: any) => item.id === id)
      : undefined

    if (!client) {
      throw error
    }

    // Fallback should still include invoice mapping for each appointment.
    let invoices: any[] = []
    try {
      const invoiceRes = await getCursorCollection('/invoice', { phone: client.phone })
      invoices = invoiceRes.data
    } catch {
      invoices = []
    }

    const appointments = (client.appointments ?? []).map((apt: any) => ({
      ...apt,
      invoices: invoices.filter(
        (inv: any) =>
          inv?.appointment?.id === apt.id ||
          (apt.invoiceId && inv?.id === apt.invoiceId),
      ),
    }))

    return {
      ...client,
      appointments,
      invoices,
    }
  }
}
