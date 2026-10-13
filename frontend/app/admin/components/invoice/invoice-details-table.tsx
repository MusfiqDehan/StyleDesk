"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InvoiceSearch } from "./invoice-search"
import {
  InvoiceStatusFilter,
  type InvoiceStatusFilterValue,
} from "./invoice-status-filter"
import {
  InvoiceDateFilter,
  type InvoiceDateFilterValue,
} from "./invoice-date-filter"
import {
  InvoiceServiceFilter,
  type InvoiceCatalogFilterValue,
} from "./invoice-service-filter"
import {
  InvoiceTableRow,
  type InvoiceTableRowData,
} from "./invoice-table-row"

interface InvoiceDetailsTableProps {
  cursorPagination?: React.ComponentProps<typeof Table>["cursorPagination"]
  invoices: InvoiceTableRowData[]
  loading?: boolean
  search: string
  onSearchChange: (value: string) => void
  statusFilter: InvoiceStatusFilterValue
  onStatusFilterChange: (value: InvoiceStatusFilterValue) => void
  dateFilter: InvoiceDateFilterValue
  onDateFilterChange: (value: InvoiceDateFilterValue) => void
  catalogFilter: InvoiceCatalogFilterValue
  onCatalogFilterChange: (value: InvoiceCatalogFilterValue) => void
  serviceOptions: { name: string; category: string }[]
  packageOptions?: { name: string }[]
  totalEntries: number
  onView?: (invoice: InvoiceTableRowData) => void
  onPrint?: (invoice: InvoiceTableRowData) => void
  onDelete?: (invoice: InvoiceTableRowData) => void
  unreadInvoiceIds?: Set<string>
  className?: string
}

const HEAD_CLASS =
  "h-11 px-3 first:pl-4 last:pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-[#666]"

export function InvoiceDetailsTable({
  cursorPagination,
  invoices,
  loading = false,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  catalogFilter,
  onCatalogFilterChange,
  serviceOptions,
  packageOptions = [],
  totalEntries,
  onView,
  onPrint,
  onDelete,
  unreadInvoiceIds,
  className,
}: InvoiceDetailsTableProps) {
  const pageOffset = cursorPagination ? cursorPagination.pageInfo.from - 1 : 0

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <InvoiceSearch value={search} onChange={onSearchChange} />
          <InvoiceStatusFilter value={statusFilter} onChange={onStatusFilterChange} />
          <InvoiceDateFilter value={dateFilter} onChange={onDateFilterChange} />
          <InvoiceServiceFilter
            value={catalogFilter}
            onChange={onCatalogFilterChange}
            serviceOptions={serviceOptions}
            packageOptions={packageOptions}
          />
          <span className="text-sm text-[#666] whitespace-nowrap">
            {loading ? "Loading..." : `${totalEntries} results`}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table cursorPagination={cursorPagination} className="table-fixed min-w-[1350px]">
          <colgroup>
            <col className="w-[52px]" />
            <col className="w-[56px]" />
            <col className="w-[120px]" />
            <col className="w-[130px]" />
            <col className="w-[110px]" />
            <col className="w-[96px]" />
            <col className="w-[96px]" />
            <col className="w-[96px]" />
            <col className="w-[96px]" />
            <col className="w-[100px]" />
            <col className="w-[100px]" />
            <col className="w-[110px]" />
            <col className="w-[100px]" />
            <col className="w-[96px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="border-b border-[#f2f2f2] hover:bg-transparent">
              <TableHead className={HEAD_CLASS}>SL.</TableHead>
              <TableHead className={HEAD_CLASS}>{/* NEW */}</TableHead>
              <TableHead className={HEAD_CLASS}>Invoice</TableHead>
              <TableHead className={HEAD_CLASS}>Customer</TableHead>
              <TableHead className={HEAD_CLASS}>Phone</TableHead>
              <TableHead className={HEAD_CLASS}>Amount</TableHead>
              <TableHead className={HEAD_CLASS}>Received</TableHead>
              <TableHead className={HEAD_CLASS}>Due</TableHead>
              <TableHead className={HEAD_CLASS}>Source</TableHead>
              <TableHead className={HEAD_CLASS}>Status</TableHead>
              <TableHead className={HEAD_CLASS}>Method</TableHead>
              <TableHead className={HEAD_CLASS}>Artist</TableHead>
              <TableHead className={HEAD_CLASS}>Date</TableHead>
              <TableHead className={HEAD_CLASS}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={14}
                  className="px-4 py-10 text-left text-sm text-muted-foreground first:pl-4 last:pr-4"
                >
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={14}
                  className="px-4 py-10 text-left text-sm text-muted-foreground first:pl-4 last:pr-4"
                >
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice, index) => (
                <InvoiceTableRow
                  key={invoice.id}
                  invoice={invoice}
                  index={index}
                  pageOffset={pageOffset}
                  isUnread={unreadInvoiceIds?.has(invoice.id) ?? false}
                  onView={onView}
                  onPrint={onPrint}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && totalEntries > 0 && (
        <></>
      )}
    </section>
  )
}
