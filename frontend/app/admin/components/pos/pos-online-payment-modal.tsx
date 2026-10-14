"use client"

import { useEffect, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatTk } from "./pos-utils"

/** Must match server PaymentMethod enum */
const ONLINE_METHODS = ["bKash", "Nagad", "Bank", "Card"] as const
export type PosOnlineMethod = (typeof ONLINE_METHODS)[number]

interface PosOnlinePaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPayable: number
  employeeNames?: string[]
  orderTakenBy: string
  submitting?: boolean
  onConfirm?: (payload: {
    amountReceived: number
    method: PosOnlineMethod
    stylist: string
    orderTakenBy: string
    note: string
  }) => void | Promise<void>
}

export function PosOnlinePaymentModal({
  open,
  onOpenChange,
  totalPayable,
  employeeNames = [],
  orderTakenBy,
  submitting = false,
  onConfirm,
}: PosOnlinePaymentModalProps) {
  const [amountReceived, setAmountReceived] = useState("")
  const [method, setMethod] = useState<PosOnlineMethod | "">("")
  const [methodOpen, setMethodOpen] = useState(false)
  const [stylist, setStylist] = useState("")
  const [stylistOpen, setStylistOpen] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setAmountReceived("0")
      setMethod("bKash")
      setMethodOpen(false)
      setStylist("")
      setStylistOpen(false)
      setNote("")
      setError("")
    }
  }, [open, totalPayable, employeeNames])

  const receivedValue = Number(amountReceived) || 0
  const amountDue = Math.max(0, totalPayable - receivedValue)

  const clampAmountReceived = (raw: string) => {
    if (raw === "") {
      setAmountReceived("")
      return
    }
    const cleaned = raw.replace(/[^\d.]/g, "")
    const parts = cleaned.split(".")
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned
    const value = Number.parseFloat(normalized)
    if (Number.isFinite(value) && value > totalPayable) {
      setAmountReceived(
        Number.isInteger(totalPayable) ? String(totalPayable) : totalPayable.toFixed(2),
      )
      return
    }
    setAmountReceived(normalized)
  }

  const fillFullAmount = () => {
    setAmountReceived(
      Number.isInteger(totalPayable) ? String(totalPayable) : totalPayable.toFixed(2),
    )
  }

  const handleConfirm = async () => {
    if (receivedValue < 0) {
      setError("Amount received cannot be negative")
      return
    }
    if (!method) {
      setError("Select a payment method")
      return
    }
    setError("")
    await onConfirm?.({
      amountReceived: receivedValue,
      method,
      stylist: stylist.trim(),
      orderTakenBy,
      note: note.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-[calc(100%-1.5rem)] max-w-[648px] gap-0 rounded-lg border border-[#f2f2f2] bg-white px-4 pt-5 pb-8 sm:w-full sm:px-6 sm:pt-6 sm:pb-12",
          "[&>button]:hidden"
        )}
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-medium text-black sm:text-xl">
            Online Payment
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded bg-[#f2f2f2] text-[#333] hover:bg-[#e7e7e7]"
            aria-label="Close"
            disabled={submitting}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="text-sm font-medium text-[#333] sm:text-base">Total payable</label>
              <div className="flex items-center rounded border border-[#f2f2f2] px-3 py-2.5">
                <span className="text-sm font-medium text-[#666]">{formatTk(totalPayable)}</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="text-base font-medium text-[#333]">Amount received</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={totalPayable}
                  value={amountReceived}
                  onChange={(e) => clampAmountReceived(e.target.value)}
                  disabled={submitting}
                  className="min-w-0 flex-1 rounded border border-[#f2f2f2] px-3 py-2.5 text-sm font-medium text-[#666] outline-none focus:border-brand-primary"
                  placeholder="e.g. 1500"
                />
                <button
                  type="button"
                  disabled={submitting || totalPayable <= 0}
                  onClick={fillFullAmount}
                  className="h-[42px] shrink-0 rounded border border-[#f2f2f2] bg-white px-3 text-sm font-medium text-[#333] hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  Full
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base font-medium text-[#333]">Amount Due</label>
            <div className="flex items-center rounded border border-brand-primary bg-brand-mist px-3 py-2.5">
              <span className="text-sm font-medium text-brand-primary">{formatTk(amountDue)}</span>
            </div>
          </div>

          <div className="relative flex flex-col gap-2">
            <label className="text-base font-medium text-[#333]">
              Choose payment method <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setMethodOpen((v) => !v)
                setStylistOpen(false)
              }}
              className="flex w-full items-center justify-between rounded border border-[#f2f2f2] px-3 py-2.5 text-left"
            >
              <span className="text-sm font-medium text-[#666]">
                {method || "Select"}
              </span>
              <ChevronDown className="size-4 text-[#666]" />
            </button>
            {methodOpen && (
              <ul className="absolute left-0 right-0 top-[72px] z-20 overflow-hidden rounded border border-[#f2f2f2] bg-white shadow-lg">
                {ONLINE_METHODS.map((opt) => (
                  <li key={opt}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-[#333] hover:bg-brand-mist"
                      onClick={() => {
                        setMethod(opt)
                        setMethodOpen(false)
                      }}
                    >
                      {opt}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="text-base font-medium text-[#333]">Cashier</label>
              <div className="flex items-center rounded border border-[#f2f2f2] bg-[#f8fafc] px-3 py-2.5">
                <span className="text-sm font-medium text-[#333]">{orderTakenBy}</span>
              </div>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col gap-2">
              <label className="text-base font-medium text-[#333]">
                Artist <span className="text-xs font-normal text-[#999]">(optional)</span>
              </label>
              <button
                type="button"
                disabled={submitting || employeeNames.length === 0}
                onClick={() => {
                  setStylistOpen((v) => !v)
                  setMethodOpen(false)
                }}
                className="flex w-full items-center justify-between rounded border border-[#f2f2f2] px-3 py-2.5 text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium text-[#666]">
                  {stylist ||
                    (employeeNames.length === 0 ? "No artists found" : "Select artist")}
                </span>
                <ChevronDown className="size-4 text-[#666]" />
              </button>
              {stylistOpen && (
                <ul className="absolute left-0 right-0 top-[72px] z-20 max-h-48 overflow-y-auto rounded border border-[#f2f2f2] bg-white shadow-lg">
                  <li>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-[#999] hover:bg-brand-mist"
                      onClick={() => {
                        setStylist("")
                        setStylistOpen(false)
                      }}
                    >
                      None
                    </button>
                  </li>
                  {employeeNames.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-[#333] hover:bg-brand-mist"
                        onClick={() => {
                          setStylist(name)
                          setStylistOpen(false)
                        }}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base font-medium text-[#333]">Payment Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={submitting}
              className="h-16 w-full resize-none rounded border border-[#f2f2f2] p-1.5 text-sm font-medium text-[#666] outline-none focus:border-brand-primary"
              placeholder="e.g. Paid via online checkout."
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="mt-2 mb-4 flex w-full items-center justify-center rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {submitting ? "Saving invoice…" : "Confirm Payment"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
