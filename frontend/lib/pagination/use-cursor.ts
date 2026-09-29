"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '@/app/admin/api/base'
import { cursorWindow, emptyPageInfo, TABLE_PAGE_SIZE, type CursorPage, type CursorSummary, type CursorPageInfo } from './cursor'

export function useLocalCursor<T>(rows: readonly T[], key: (row: T) => string) {
  const [position, setPosition] = useState<{ signature: string; cursor: string | null }>({ signature: '', cursor: null })
  const occurrences = new Map<string, number>()
  const indexed = rows.map(row => {
    const id = key(row), occurrence = occurrences.get(id) ?? 0
    occurrences.set(id, occurrence + 1)
    return { row, key: JSON.stringify([id, occurrence]) }
  })
  const signature = JSON.stringify(indexed.map(row => row.key))
  const cursor = position.signature === signature ? position.cursor : null
  const result = cursorWindow(indexed, row => row.key, cursor)
  return { ...result, data: result.data.map(item => item.row), onCursorChange: (cursor: string | null) => setPosition({ signature, cursor }) }
}
/** All request state belongs to this table. Stale responses cannot replace a new filter or branch. */
export function useRemoteCursor<T>(path: string, params: Record<string, unknown> = {}, enabled = true) {
  const query = JSON.stringify(params)
  const scope = path + query
  const [position, setPosition] = useState<{ scope: string; cursor: string | null }>({ scope: '', cursor: null })
  const cursor = position.scope === scope ? position.cursor : null
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ scope: string; path: string; data: T[]; pageInfo: CursorPageInfo; summary?: CursorSummary }>({ scope: '', path: '', data: [], pageInfo: emptyPageInfo })
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    const id = ++generation.current
    const controller = new AbortController()
    setLoading(true); setError('')
    api.get<CursorPage<T>>(path, { params: { ...JSON.parse(query), pagination: 'cursor', cursor: cursor ?? 'start', limit: TABLE_PAGE_SIZE }, cache: false, signal: controller.signal })
      .then(({ data }) => {
        if (id !== generation.current) return
        if (!data.pageInfo || !Array.isArray(data.data)) throw new Error('Invalid paginated response')
        if (cursor && !data.data.length) { setPosition({ scope, cursor: null }); return }
        setResult({ scope, path, data: data.data, pageInfo: data.pageInfo, summary: data.summary })
      })
      .catch(error => {
        if (controller.signal.aborted || id !== generation.current) return
        if (error?.response?.data?.code === 'INVALID_CURSOR' && cursor) { setPosition({ scope, cursor: null }); return }
        setError(error?.response?.data?.message ?? error.message ?? 'Could not load this table')
      })
      .finally(() => { if (id === generation.current && !controller.signal.aborted) setLoading(false) })
    return () => { generation.current++; controller.abort() }
  }, [path, query, scope, cursor, revision, enabled])
  useEffect(() => {
    const reset = () => { setPosition({ scope, cursor: null }); refresh() }
    window.addEventListener('branch-changed', reset)
    return () => window.removeEventListener('branch-changed', reset)
  }, [scope, refresh])
  return useMemo(() => ({
    data: result.scope === scope ? result.data : [], pageInfo: result.scope === scope ? result.pageInfo : emptyPageInfo,
    summary: result.path === path ? result.summary : undefined,
    loading, error, refresh, onCursorChange: (cursor: string | null) => setPosition({ scope, cursor }),
  }), [result, path, scope, loading, error, refresh])
}
