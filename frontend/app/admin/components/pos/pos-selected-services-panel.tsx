"use client"

import { Minus, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

function formatTk(value: number) {
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`
}

function padCount(count: number) {
  return String(count).padStart(2, "0")
}

export interface PosCartItem {
  id: string
  name: string
  price: number
  quantity: number
  type: "service" | "package"
}

interface PosSelectedServicesPanelProps {
  items: PosCartItem[]
  onIncrement: (id: string, type: PosCartItem["type"]) => void
  onDecrement: (id: string, type: PosCartItem["type"]) => void
  onRemove: (id: string, type: PosCartItem["type"]) => void
  onClear: () => void
  className?: string
}

export function PosSelectedServicesPanel({
  items,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  className,
}: PosSelectedServicesPanelProps) {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <aside
      className={cn(
        "flex h-[340px] max-h-[340px] flex-col overflow-hidden rounded-2xl border border-brand-line bg-white xl:h-full xl:max-h-none xl:min-h-[560px]",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-3 sm:px-3.5 sm:pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-semibold text-brand-ink sm:text-lg">Selected Services</h2>
          <span className="flex h-7 shrink-0 items-center rounded-lg bg-brand-mist px-2.5 text-sm font-medium text-brand-primary sm:h-8 sm:px-3 sm:text-base">
            {padCount(totalCount)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={items.length === 0}
          className="flex h-8 w-16 shrink-0 items-center justify-center rounded-xl border border-red-500 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {/* Desktop column headers */}
      <div className="mx-3.5 mt-4 hidden shrink-0 items-center gap-2 border-y border-brand-line py-3 text-sm font-medium text-brand-ink md:flex">
        <span className="min-w-0 flex-[1.4]">Product</span>
        <span className="w-[57px] shrink-0">Price</span>
        <span className="w-[68px] shrink-0">Quantity</span>
        <span className="min-w-0 flex-1">Sub Total</span>
        <span className="w-4 shrink-0" aria-hidden />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-3.5">
        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-brand-muted md:h-40">
            No services selected
          </div>
        ) : (
          <ul className="flex flex-col py-2 md:py-0">
            {items.map((item) => {
              const subTotal = item.price * item.quantity
              return (
                <li
                  key={`${item.type}-${item.id}`}
                  className="border-b border-brand-line py-2.5 md:flex md:items-center md:gap-2 md:py-2"
                >
                  {/* Mobile card row */}
                  <div className="flex items-start justify-between gap-2 md:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#333]" title={item.name}>
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#666]">
                        {formatTk(item.price)} · {formatTk(subTotal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id, item.type)}
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="size-3" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 md:hidden">
                    <span className="text-xs text-[#666]">Qty</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDecrement(item.id, item.type)}
                        className="flex size-7 items-center justify-center rounded-lg border border-brand-line text-brand-muted hover:bg-brand-mist"
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="size-3.5" strokeWidth={2.5} />
                      </button>
                      <span className="flex w-8 items-center justify-center text-sm font-medium text-[#666]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncrement(item.id, item.type)}
                        className="flex size-7 items-center justify-center rounded-lg border border-brand-line text-brand-muted hover:bg-brand-mist"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="size-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Desktop table row */}
                  <p className="hidden min-w-0 flex-[1.4] truncate text-xs font-medium text-[#666] md:block" title={item.name}>
                    {item.name}
                  </p>
                  <p className="hidden w-[57px] shrink-0 text-xs font-medium text-[#666] md:block">
                    {formatTk(item.price)}
                  </p>
                  <div className="hidden w-[68px] shrink-0 items-center gap-0.5 md:flex">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.id, item.type)}
                      className="flex size-5 items-center justify-center rounded-md border border-brand-line text-brand-muted hover:bg-brand-mist"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus className="size-3" strokeWidth={2.5} />
                    </button>
                    <span className="flex w-6 items-center justify-center text-xs font-medium text-[#666]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.id, item.type)}
                      className="flex size-5 items-center justify-center rounded-md border border-brand-line text-brand-muted hover:bg-brand-mist"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus className="size-3" strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="hidden min-w-0 flex-1 text-xs font-medium text-[#666] md:block">
                    {formatTk(subTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id, item.type)}
                    className="hidden size-4 shrink-0 items-center justify-center rounded-md border border-red-500 text-red-500 hover:bg-red-50 md:flex"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="size-2.5" strokeWidth={2.5} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
