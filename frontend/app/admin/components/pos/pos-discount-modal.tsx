"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type PosDiscountType = "percentage" | "flat"

interface PosDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  discountType: PosDiscountType
  discountValue: number
  onSubmit: (payload: { type: PosDiscountType; value: number }) => void
  onRemove?: () => void
}

const DISCOUNT_TYPES: { id: PosDiscountType; label: string }[] = [
  { id: "percentage", label: "Percentage" },
  { id: "flat", label: "Flat Amount" },
]

export function PosDiscountModal({
  open,
  onOpenChange,
  discountType,
  discountValue,
  onSubmit,
  onRemove,
}: PosDiscountModalProps) {
  const [type, setType] = useState<PosDiscountType>("percentage")
  const [value, setValue] = useState("")
  const [typeOpen, setTypeOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setType(discountType)
      setValue(discountValue > 0 ? String(discountValue) : "")
      setTypeOpen(false)
    }
  }, [open, discountType, discountValue])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setTypeOpen(false)
      }
    }
    window.addEventListener("mousedown", onPointerDown)
    return () => window.removeEventListener("mousedown", onPointerDown)
  }, [])

  const selectedLabel =
    DISCOUNT_TYPES.find((item) => item.id === type)?.label ?? "Percentage"

  const handleSubmit = () => {
    const raw = Math.max(0, Number(value) || 0)
    const next =
      type === "percentage" ? Math.min(100, raw) : raw
    onSubmit({ type, value: next })
    onOpenChange(false)
  }

  const handleRemove = () => {
    onRemove?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!gap-0 !p-0 px-0 py-0 w-[calc(100%-1.5rem)] sm:w-full sm:px-0 sm:max-w-[480px]",
          "overflow-hidden rounded-xl border border-[#f2f2f2] bg-white",
          "shadow-[0px_16px_48px_rgba(0,0,0,0.12)]",
          "[&>button]:hidden"
        )}
      >
        <div className="relative flex h-14 w-full items-center bg-brand-primary px-6">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Discount
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

        <div className="flex w-full flex-col gap-5 px-6 pt-6 pb-2">
          <div ref={dropdownRef} className="relative flex flex-col gap-2.5">
            <label className="text-[15px] font-medium text-[#333]">
              Discount Type <span className="text-[#ef4444]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setTypeOpen((openState) => !openState)}
              className={cn(
                "flex h-11 w-full items-center justify-between rounded-lg border border-[#e7e7e7] bg-white px-3.5",
                "text-left text-[15px] font-medium text-[#333] outline-none",
                "transition-colors hover:border-[#cfd8e3] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
                typeOpen && "border-brand-primary ring-2 ring-brand-primary/20"
              )}
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
            >
              <span>{selectedLabel}</span>
              <ChevronDown
                className={cn(
                  "size-4 text-[#666] transition-transform",
                  typeOpen && "rotate-180"
                )}
              />
            </button>

            {typeOpen && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-[76px] z-20 overflow-hidden rounded-lg border border-[#e7e7e7] bg-white shadow-[0px_8px_24px_rgba(0,0,0,0.08)]"
              >
                {DISCOUNT_TYPES.map((item) => {
                  const selected = item.id === type
                  return (
                    <li key={item.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full px-3.5 py-2.5 text-left text-[15px] font-medium transition-colors",
                          selected
                            ? "bg-brand-mist text-brand-primary"
                            : "text-[#333] hover:bg-[#fafafa]"
                        )}
                        onClick={() => {
                          setType(item.id)
                          setTypeOpen(false)
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="pos-discount-value" className="text-[15px] font-medium text-[#333]">
              Value <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <input
                id="pos-discount-value"
                type="number"
                min={0}
                max={type === "percentage" ? 100 : undefined}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percentage" ? "e.g. 10" : "e.g. 500"}
                className={cn(
                  "h-11 w-full rounded-lg border border-[#e7e7e7] bg-white px-3.5 pr-12",
                  "text-[15px] font-medium text-[#333] outline-none",
                  "placeholder:font-normal placeholder:text-[#999]",
                  "transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                )}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-[#999]">
                {type === "percentage" ? "%" : "Tk"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex w-full flex-col-reverse gap-2.5 border-t border-[#f2f2f2] bg-[#fafafa] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          {onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className="h-10 rounded-lg border border-[#e7e7e7] bg-white px-4 text-sm font-medium text-[#333] transition-colors hover:bg-[#f2f2f2]"
            >
              Remove Discount
            </button>
          )}
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
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
