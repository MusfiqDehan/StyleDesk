import api from '../base'
import { CACHE, asList, consumeStale, markStale } from '@admin/lib/cache'

const TTL = 3 * 60 * 1000 // 3 min — stock levels change with transactions

export interface InventoryItem {
  id: string
  name: string
  category: string
  stockQty: number
  minStockLevel: number
  unitPrice: number
  supplier: string
  expiryDate: string
}

export type CreateInventoryPayload = Omit<InventoryItem, 'id'>
export type UpdateInventoryPayload = Partial<CreateInventoryPayload>

export async function getInventory(filters?: {
  name?: string
  page?: number
  limit?: number
  sortStock?: 'asc' | 'desc'
}, noCache = false) {
  const override = noCache || consumeStale(CACHE.INVENTORY)
  const { data } = await api.get('/inventory', {
    id: `${CACHE.INVENTORY}:${JSON.stringify(filters ?? {})}`,
    params: filters,
    cache: noCache ? false : { ttl: TTL, override },
  })
  // Keep paginated shape when present; otherwise normalize to a list.
  if (data && typeof data === 'object' && Array.isArray((data as any).data)) return data
  return asList(data)
}

export async function createInventoryItem(payload: CreateInventoryPayload) {
  const { data } = await api.post('/inventory', payload)
  markStale(CACHE.INVENTORY, CACHE.DASHBOARD)
  return data
}

export async function updateInventoryItem(id: string, payload: UpdateInventoryPayload) {
  const { data } = await api.patch(`/inventory/${id}`, payload)
  markStale(CACHE.INVENTORY, CACHE.DASHBOARD)
  return data
}

export async function deleteInventoryItem(id: string) {
  const { data } = await api.delete(`/inventory/${id}`)
  markStale(CACHE.INVENTORY, CACHE.DASHBOARD)
  return data
}
