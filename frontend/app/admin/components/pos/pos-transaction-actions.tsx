"use client"

import { cn } from "@/lib/utils"

interface PosTransactionActionsProps {
  invoiceNo: string
  heldCount?: number
  onHold?: () => void
  onViewHolds?: () => void
  onNew?: () => void
  onReset?: () => void
  className?: string
}

export function PosTransactionActions({
  invoiceNo,
  heldCount = 0,
  onHold,
  onViewHolds,
  onNew,
  onReset,
  className,
}: PosTransactionActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-brand-line pb-2.5",
        className
      )}
    >
      <span
        className={cn(
          "flex w-fit max-w-full items-center justify-center break-all rounded-lg px-2.5 py-1 text-xs font-medium leading-5 sm:px-3 sm:text-[13px]",
          invoiceNo
            ? "bg-brand-mist text-brand-primary"
            : "bg-brand-mist text-brand-muted italic",
        )}
        title={invoiceNo ? `Invoice ${invoiceNo}` : "Invoice number is assigned after payment"}
      >
        {invoiceNo ? `#${invoiceNo}` : "Invoice on payment"}
      </span>
      <div className="flex items-center gap-2">
        <div className="relative flex flex-1 sm:flex-none">
          <button
            type="button"
            onClick={onHold}
            className="flex h-8 w-full items-center justify-center rounded-xl border border-brand-line px-3 text-[13px] font-medium text-brand-muted hover:bg-brand-mist sm:w-16"
          >
            Hold
          </button>
          {heldCount > 0 && (
            <button
              type="button"
              onClick={onViewHolds}
              title={`${heldCount} held transaction${heldCount === 1 ? "" : "s"} — tap to recall`}
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-semibold leading-none text-white hover:bg-brand-hover"
            >
              {heldCount > 9 ? "9+" : heldCount}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="flex h-8 flex-1 items-center justify-center rounded-xl border border-brand-line text-[13px] font-medium text-brand-muted hover:bg-brand-mist sm:w-16 sm:flex-none"
        >
          New
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex h-8 flex-1 items-center justify-center rounded-xl border border-red-500 text-[13px] font-medium text-red-500 hover:bg-red-50 sm:w-16 sm:flex-none"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
