"use client"
import { ArrowLeft, ArrowRight, RotateCcw, Rows3 } from 'lucide-react'
import type { CursorPageInfo } from '@/lib/pagination/cursor'
import { cn } from '@/lib/utils'
export function CursorPagination({ pageInfo, onCursorChange, loading = false, error, retry, className }: {
  pageInfo: CursorPageInfo; onCursorChange: (cursor: string | null) => void; loading?: boolean; error?: string; retry?: () => void; className?: string
}) {
  const { from, to, total, page, hasNextPage, hasPreviousPage, nextCursor, previousCursor } = pageInfo
  const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-35'
  return <nav aria-label="Table pagination" aria-busy={loading} className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 print:hidden', className)}>
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground"><Rows3 size={16} aria-hidden="true" /></span>
      <div><p role="status" aria-live="polite" className="text-xs font-medium text-foreground">{loading ? 'Loading rows…' : <><span className="tabular-nums">{from}–{to}</span> <span className="font-normal text-muted-foreground">of {total.toLocaleString()} rows</span></>}</p><p className="mt-0.5 text-[10px] text-muted-foreground">10 rows per page</p></div>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error} {retry && <button type="button" onClick={retry} className="underline">Retry</button>}</p>}
    <div className="flex items-center gap-2">
      <button type="button" className={button} aria-label="First page" disabled={loading || !hasPreviousPage} onClick={() => onCursorChange(null)}><RotateCcw size={14} /></button>
      <button type="button" className={button} disabled={loading || !hasPreviousPage || !previousCursor} onClick={() => onCursorChange(previousCursor)}><ArrowLeft size={14} /><span className="hidden sm:inline">Previous</span></button>
      <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary/10 px-3 text-xs font-semibold tabular-nums text-primary" aria-label={`Page ${page}`}>{page}</span>
      <button type="button" className={button} disabled={loading || !hasNextPage || !nextCursor} onClick={() => onCursorChange(nextCursor)}><span className="hidden sm:inline">Next</span><ArrowRight size={14} /></button>
    </div>
  </nav>
}
