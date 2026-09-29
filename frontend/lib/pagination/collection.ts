import api from '@/app/admin/api/base'
import { TABLE_PAGE_SIZE, type CursorPage } from './cursor'
/** Assemble the complete collection only for exports, derived summaries and
 * cross-row reports. Every request still observes the API's 10-row cursor contract.
 * Interactive stored-entity lists use useRemoteCursor instead.
 */
export async function getCursorCollection<T = any>(path: string, params: Record<string, unknown> = {}): Promise<Record<string, any> & { data: T[]; total: number }> {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  let first: Record<string, any> | undefined
  do {
    const response: { data: CursorPage<T> & Record<string, any> } = await api.get<CursorPage<T> & Record<string, any>>(path, {
      params: { ...params, pagination: 'cursor', cursor: cursor ?? 'start', limit: TABLE_PAGE_SIZE }, cache: false,
    })
    const page: CursorPage<T> & Record<string, any> = response.data
    if (!page.pageInfo || !Array.isArray(page.data)) throw new Error('Invalid cursor collection')
    first ??= page
    rows.push(...page.data)
    cursor = page.pageInfo.nextCursor
    if (cursor && seen.has(cursor)) throw new Error('Repeated pagination cursor')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return { ...first, data: rows, total: rows.length }
}
