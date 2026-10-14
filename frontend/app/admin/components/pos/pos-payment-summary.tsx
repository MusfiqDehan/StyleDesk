"use client"

import { cn } from "@/lib/utils"
import { formatTk } from "./pos-utils"
import type { PosDiscountType } from "./pos-discount-modal"

interface PosPaymentSummaryProps {
  subTotal: number
  taxRate: number
  taxAmount: number
  discountType: PosDiscountType
  discountValue: number
  discountAmount: number
  totalPayable: number
  onDiscountClick?: () => void
  onTaxClick?: () => void
  className?: string
}

function discountLabel(type: PosDiscountType, value: number) {
  if (type === "flat") {
    return value > 0 ? `Discount (Tk.${value})` : "Discount"
  }
  return `Discount (${value}%)`
}

export function PosPaymentSummary({
  subTotal,
  taxRate,
  taxAmount,
  discountType,
  discountValue,
  discountAmount,
  totalPayable,
  onDiscountClick,
  onTaxClick,
  className,
}: PosPaymentSummaryProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b-[1.5px] border-dashed border-brand-line pb-3",
        className
      )}
    >
      <h3 className="text-[15px] font-semibold text-brand-ink">Payment Summary</h3>

      <div className="flex flex-col gap-1 border-b border-brand-line pb-2 text-[13px] font-medium text-brand-muted">
        <div className="flex items-center justify-between">
          <span className="w-[120px] truncate">Sub Total</span>
          <span className="min-w-0 flex-1 truncate text-right">{formatTk(subTotal)}</span>
        </div>
        <button
          type="button"
          onClick={onTaxClick}
          className="flex w-full items-center justify-between text-left transition-colors hover:text-brand-primary"
        >
          <span className="w-[120px] truncate underline decoration-[var(--brand-primary)]/decoration-1 underline-offset-2">
            VAT ({taxRate}%)
          </span>
          <span className="min-w-0 flex-1 truncate text-right">{formatTk(taxAmount)}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDiscountClick?.()
          }}
          className="relative z-10 flex w-full cursor-pointer items-center justify-between text-left transition-colors hover:text-brand-primary"
        >
          <span className="w-[140px] truncate underline decoration-[var(--brand-primary)]/decoration-1 underline-offset-2">
            {discountLabel(discountType, discountValue)}
          </span>
          <span className="min-w-0 flex-1 truncate text-right">
            {formatTk(discountAmount, true)}
          </span>
        </button>
      </div>

      <div className="flex items-start justify-between rounded-xl bg-brand-mist px-3 py-2 text-[13px] font-medium text-brand-primary">
        <span>Total Payable</span>
        <span>{formatTk(totalPayable)}</span>
      </div>
    </div>
  )
}
