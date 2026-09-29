export const TABLE_PAGE_SIZE = 10
export type CursorPageInfo = {
  pageSize: number; page: number; total: number; from: number; to: number
  hasNextPage: boolean; hasPreviousPage: boolean
  nextCursor: string | null; previousCursor: string | null
}
export type CursorSummary = {
  total: number; active: number; attention: number; published: number; protected: number; permissionRules: number;
  distinctCurrencies: number; distinctRoles: number; distinctActions: number; distinctActors: number; distinctTenants: number;
  metricCounts?: Record<string, number>;
  statuses: string[]; statusCounts: Record<string, number>
}
export type CursorPage<T> = { data: T[]; total: number; pageInfo: CursorPageInfo; summary?: CursorSummary }
export const emptyPageInfo: CursorPageInfo = {
  pageSize: TABLE_PAGE_SIZE, page: 1, total: 0, from: 0, to: 0,
  hasNextPage: false, hasPreviousPage: false, nextCursor: null, previousCursor: null,
}
/** Local keyset adapter for computed rows and tables embedded in an existing response.
 * The supplied order is authoritative. Tokens identify a row boundary, never an offset.
 */
export function cursorWindow<T>(rows: readonly T[], key: (row: T) => string, cursor: string | null) {
  let boundary: { key: string; direction: 'next' | 'previous'; page: number } | null = null
  try { boundary = cursor ? JSON.parse(cursor) : null } catch { /* restart */ }
  const index = boundary ? rows.findIndex(row => key(row) === boundary.key) : -1
  const valid = !boundary || index >= 0
  const before = valid && boundary?.direction === 'previous'
  const first = !boundary || !valid ? 0 : before ? Math.max(0, index - TABLE_PAGE_SIZE) : index + 1
  const end = before ? index : Math.min(rows.length, first + TABLE_PAGE_SIZE)
  const data = rows.slice(first, end)
  const previous = first > 0, next = first + data.length < rows.length
  const page = valid && boundary ? boundary.page : 1
  const token = (row: T, direction: 'next' | 'previous', page: number) => JSON.stringify({ key: key(row), direction, page })
  const pageInfo: CursorPageInfo = {
    pageSize: TABLE_PAGE_SIZE, page, total: rows.length,
    from: data.length ? first + 1 : 0, to: data.length ? first + data.length : 0,
    hasPreviousPage: previous, hasNextPage: next,
    previousCursor: previous && data.length ? token(data[0], 'previous', Math.max(1, page - 1)) : null,
    nextCursor: next && data.length ? token(data[data.length - 1], 'next', page + 1) : null,
  }
  return { data, pageInfo, total: rows.length }
}
