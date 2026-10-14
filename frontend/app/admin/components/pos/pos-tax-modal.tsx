"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Kept for call-site compatibility; Settings tax is never updated from POS. */
export type PosTaxApplyMode = "this-time" | "always"

interface PosTaxModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taxRate: number
  onSubmit: (payload: { taxRate: number; applyMode: PosTaxApplyMode }) => void
  onRemove: () => void
}

export function PosTaxModal({
  open,
  onOpenChange,
  taxRate,
  onSubmit,
  onRemove,
}: PosTaxModalProps) {
  const [percent, setPercent] = useState("")

  useEffect(() => {
    if (open) {
      setPercent(taxRate > 0 ? String(taxRate) : "")
    }
  }, [open, taxRate])

  const handleSubmit = () => {
    const next = Math.min(100, Math.max(0, Number(percent) || 0))
    onSubmit({ taxRate: next, applyMode: "this-time" })
    onOpenChange(false)
  }

  const handleRemove = () => {
    onRemove()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!gap-0 !p-0 px-0 py-0 w-[calc(100%-1.5rem)] sm:w-full sm:px-0 sm:max-w-[520px]",
          "overflow-hidden rounded-xl border border-[#f2f2f2] bg-white",
          "shadow-[0px_16px_48px_rgba(0,0,0,0.12)]",
          "[&>button]:hidden"
        )}
      >
        <div className="relative flex h-14 w-full items-center bg-brand-primary px-6">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            VAT
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm transition-opacity hover:opacity-90"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex w-full flex-col gap-6 px-6 pt-6 pb-2">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="pos-tax-percent" className="text-[15px] font-medium text-[#333]">
              VAT Percentage (%) <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <input
                id="pos-tax-percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="e.g. 12"
                className={cn(
                  "h-11 w-full rounded-lg border border-[#e7e7e7] bg-white px-3.5 pr-10",
                  "text-[15px] font-medium text-[#333] outline-none",
                  "placeholder:font-normal placeholder:text-[#999]",
                  "transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                )}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-[#999]">
                %
              </span>
            </div>
            <p className="text-xs text-[#666]">
              Applies to this transaction only. Change the global default in Settings → Billing.
            </p>
          </div>
        </div>

        <div className="mt-4 flex w-full flex-col-reverse gap-2.5 border-t border-[#f2f2f2] bg-[#fafafa] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleRemove}
            className="h-10 rounded-lg border border-[#e7e7e7] bg-white px-4 text-sm font-medium text-[#333] transition-colors hover:bg-[#f2f2f2]"
          >
            Remove VAT
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-lg bg-[#333] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1a1a1a]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-10 rounded-lg bg-brand-primary px-5 text-sm font-medium text-white shadow-[0px_4px_12px_rgba(0,118,233,0.28)] transition-colors hover:bg-brand-hover"
          >
            Submit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
