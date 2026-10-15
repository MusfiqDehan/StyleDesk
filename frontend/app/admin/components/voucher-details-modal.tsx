"use client"

import { Printer, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type Voucher,
  formatVoucherAmount,
  formatVoucherDisplayDate,
} from "@admin/lib/vouchers"

interface VoucherDetailsModalProps {
  voucher: Voucher | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint?: (voucher: Voucher) => void
}

export function VoucherDetailsModal({
  voucher,
  open,
  onOpenChange,
  onPrint,
}: Readonly<VoucherDetailsModalProps>) {
  const isExpense = voucher?.type === "Expense"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-lg sm:max-w-[440px]"
      >
        {voucher && (
          <div className="bg-white">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-semibold text-[#111]">
                  {voucher.voucherNo}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[12px] text-[#888]">
                  {formatVoucherDisplayDate(voucher.date)}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                    isExpense
                      ? "bg-rose-50 text-rose-700"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {voucher.type}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex size-7 items-center justify-center rounded-md text-[#888] hover:bg-brand-mist hover:text-[#333]"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 pb-5">
              <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  {isExpense ? "Expense voucher" : "Income voucher"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[22px] font-semibold tabular-nums",
                    isExpense ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {formatVoucherAmount(voucher.type, voucher.amount)}
                </p>
              </div>

              <div className="space-y-3 text-[13px]">
                <div className="flex items-start justify-between gap-4">
                  <span className="shrink-0 text-[#888]">Title</span>
                  <span className="text-right font-medium text-[#333]">{voucher.title}</span>
                </div>
                {voucher.description && voucher.description !== voucher.title && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-[#888]">Description</span>
                    <span className="text-right text-[#333]">{voucher.description}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#888]">Date</span>
                  <span className="font-medium text-[#333]">
                    {formatVoucherDisplayDate(voucher.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#888]">Type</span>
                  <span
                    className={cn(
                      "font-medium",
                      isExpense ? "text-rose-600" : "text-emerald-600",
                    )}
                  >
                    {voucher.type}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 pb-5">
              <Button
                type="button"
                variant="ghost"
                className="h-9 flex-1 text-[#555] hover:bg-brand-mist"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="h-9 flex-1 bg-brand-primary text-white hover:bg-brand-hover"
                onClick={() => onPrint?.(voucher)}
               accessAction="export">
                <Printer className="mr-1.5 size-3.5" />
                Print
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
