import { getCursorCollection } from "@/lib/pagination/collection"
const ledgerEndpoint=()=>typeof window!=='undefined'&&window.location.pathname.startsWith('/admin/vouchers')?'/vouchers':'/finance'
import api from '../base'
import { CACHE, clearCacheByPrefix, consumeStale, markStale } from '@admin/lib/cache'

const TTL = 2 * 60 * 1000

/** Drop every cached finance response so Income & Expense refetches immediately. */
export function invalidateFinanceCache() {
  markStale(CACHE.FINANCE, CACHE.DASHBOARD)
  clearCacheByPrefix(CACHE.FINANCE)
}

export type FinanceTrendRange =
  | 'this_year'
  | 'last_6_months'
  | 'last_3_months'
  | 'this_month'

export interface FinanceTrendPoint {
  key: string
  label: string
  income: number
  expense: number
}

export interface FinanceTrendResponse {
  range: FinanceTrendRange
  points: FinanceTrendPoint[]
  maxValue: number
}

export interface FinanceEntry {
  id: string
  type: 'income' | 'expense'
  title: string
  description: string | null
  amount: number
  date: string
  createdAt: string
  updatedAt: string
}

export interface FinanceOverview {
  year?: number
  totalIncome: number
  totalExpense: number
  netBalance: number
  entriesLogged: number
  profitable: boolean
  periodLabel: string
  previousYear?: number
  previousNetBalance?: number
  netYoYPercent?: number | null
  netYoYDirection?: "higher" | "lower" | "same" | null
  netYoYLabel?: string
}

export async function getFinanceOverview(year?: number, noCache = false) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get('/finance/overview', {
    params: year ? { year } : undefined,
    id: `${CACHE.FINANCE}-overview-${year ?? 'current'}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data as FinanceOverview
}

export async function getFinanceTrend(range: FinanceTrendRange = 'this_year', year?: number, noCache = false) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get('/finance/trend', {
    params: { range, ...(year ? { year } : {}) },
    id: `${CACHE.FINANCE}-trend-${range}-${year ?? 'current'}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data as FinanceTrendResponse
}

export async function getFinanceEntries(page = 1, limit = 50, noCache = false) {
  if (limit >= 100) return getCursorCollection(ledgerEndpoint(), { _sort: 'date', _order: 'desc' })
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get(ledgerEndpoint(), {
    params: { page, limit },
    id: `${CACHE.FINANCE}-list`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data
}

export async function createFinanceEntry(payload: {
  type: 'income' | 'expense'
  title: string
  description?: string
  category?: string
  amount: number
  date: string
}) {
  const { data } = await api.post(ledgerEndpoint(), payload)
  invalidateFinanceCache()
  return data as FinanceEntry
}

export async function deleteFinanceEntry(id: string) {
  const { data } = await api.delete(`${ledgerEndpoint()}/${id}`)
  invalidateFinanceCache()
  return data
}

export type FinanceTransactionType = 'all' | 'income' | 'expense'

export interface FinanceMonthlyCategoryRow {
  label: string
  months: number[]
  total: number
}

export interface FinanceMonthlySummary {
  year: number
  months: Array<{ index: number; label: string; key: string }>
  income: {
    categories: FinanceMonthlyCategoryRow[]
    totals: number[]
    grandTotal: number
  }
  expense: {
    categories: FinanceMonthlyCategoryRow[]
    totals: number[]
    grandTotal: number
  }
  netBalance: {
    label: string
    months: number[]
    total: number
  }
}

export interface FinanceTransaction {
  id: string
  date: string
  title: string
  description: string
  category: string
  type: 'income' | 'expense'
  amount: number
  source: 'ledger' | 'invoice'
}

export async function getFinanceMonthlySummary(year?: number, noCache = false) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get('/finance/monthly-summary', {
    params: year ? { year } : undefined,
    id: `${CACHE.FINANCE}-summary-${year ?? 'current'}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data as FinanceMonthlySummary
}

export async function getFinanceTransactions(
  params: {
    search?: string
    type?: FinanceTransactionType
    from?: string
    to?: string
    page?: number
    limit?: number
  },
  noCache = false,
) {
  const override = noCache || consumeStale(CACHE.FINANCE)
  const { data } = await api.get('/finance/transactions', {
    params,
    id: `${CACHE.FINANCE}-tx-${JSON.stringify(params)}`,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data as {
    data: FinanceTransaction[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
