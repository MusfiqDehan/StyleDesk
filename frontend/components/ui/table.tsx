'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

import { useLocalCursor } from '@/lib/pagination/use-cursor'
import { CursorPagination } from '@/components/pagination/cursor-pagination'
import type { CursorPageInfo } from '@/lib/pagination/cursor'

type PaginationControl = { pageInfo: CursorPageInfo; onCursorChange: (cursor: string | null) => void; loading?: boolean; error?: string; refresh?: () => void }
function flattenRows(children: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<{children?: React.ReactNode}>(child)) return []
    return child.type === React.Fragment ? flattenRows(child.props.children) : [child]
  })
}
/** Every screen table gets the same ten-row cursor controls. Printable line-item
 * documents may opt out. Remote collections supply their server page metadata. */
function Table({ className, children, pagination = true, cursorPagination, ...props }: React.ComponentProps<'table'> & { pagination?: boolean; cursorPagination?: PaginationControl }) {
  const contents = React.Children.toArray(children)
  const body = contents.find(child => React.isValidElement(child) && (child.type === TableBody || child.type === 'tbody')) as React.ReactElement<{children?: React.ReactNode}> | undefined
  const allRows = cursorPagination || !pagination ? [] : flattenRows(body?.props.children)
  const placeholder = allRows.length === 1 && React.isValidElement<{children?: React.ReactNode}>(allRows[0]) && flattenRows(allRows[0].props.children).some(cell => (cell.props as {colSpan?: number}).colSpan !== undefined)
  const rows = placeholder ? [] : allRows
  const local = useLocalCursor(rows, row => String(row.key))
  const control = cursorPagination ?? local
  const rendered = pagination && !cursorPagination && body && !placeholder
    ? contents.map(child => child === body ? React.cloneElement(body, undefined, local.data) : child) : children
  return <div data-slot="paginated-table" className="w-full min-w-0">
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props}>{rendered}</table>
    </div>
    {pagination && <CursorPagination pageInfo={control.pageInfo} onCursorChange={control.onCursorChange} loading={cursorPagination?.loading} error={cursorPagination?.error} retry={cursorPagination?.refresh} />}
  </div>
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 first:pl-6 last:pr-6 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-2 py-2 first:pl-6 last:pr-6 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
