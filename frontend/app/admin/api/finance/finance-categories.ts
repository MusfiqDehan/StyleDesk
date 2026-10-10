import api from '../base'
import { CACHE, consumeStale, markStale } from '@admin/lib/cache'

const TTL = 2 * 60 * 1000

export type FinanceCategoryType = 'income' | 'expense'
export type FinanceCategoryStatus = 'active' | 'inactive'

export interface FinanceCategory {
  id: string
  name: string
  type: FinanceCategoryType
  status: FinanceCategoryStatus
  code?: string | null
  isSystem?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Expense categories the server writes from Manage Payroll only. Their totals are
 * `SUM(netSalary)` over Paid payrolls, so manual entries must not target them.
 */
export const PAYROLL_OWNED_CATEGORY_CODES = ['employee_salary', 'employee_bonus']

export interface FinanceCategoryListResponse {
  data: FinanceCategory[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getFinanceCategories(params?: {
  page?: number
  limit?: number
  search?: string
  type?: FinanceCategoryType | 'all'
  status?: FinanceCategoryStatus | 'all'
}, noCache = false) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get('/finance/categories', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 15,
      search: params?.search || undefined,
      type: params?.type && params.type !== 'all' ? params.type : undefined,
      status: params?.status && params.status !== 'all' ? params.status : undefined,
    },
    id: `${CACHE.FINANCE}-categories-${JSON.stringify(params ?? {})}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data as FinanceCategoryListResponse
}

export async function getActiveFinanceCategories(type?: FinanceCategoryType, noCache = false) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get(typeof window!=='undefined'&&window.location.pathname.startsWith('/admin/vouchers')?'/vouchers/categories':'/finance/category-options', {
    params: type ? { type } : undefined,
    id: `${CACHE.FINANCE}-categories-active-${type ?? 'all'}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return Array.isArray(data) ? data : [] as FinanceCategory[]
}

export async function createFinanceCategory(payload: {
  name: string
  type: FinanceCategoryType
  status?: FinanceCategoryStatus
}) {
  const { data } = await api.post('/finance/categories', payload)
  markStale(CACHE.FINANCE)
  return data as FinanceCategory
}

export async function updateFinanceCategory(
  id: string,
  payload: Partial<{
    name: string
    type: FinanceCategoryType
    status: FinanceCategoryStatus
  }>,
) {
  const { data } = await api.patch(`/finance/categories/${id}`, payload)
  markStale(CACHE.FINANCE)
  return data as FinanceCategory
}

export async function deleteFinanceCategory(id: string) {
  const { data } = await api.delete(`/finance/categories/${id}`)
  markStale(CACHE.FINANCE)
  return data
}
