"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Clock, Trash2, Undo2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { PosHeldTransaction } from "@admin/lib/pos-hold-storage"
import { computeHeldTotal } from "@admin/lib/pos-hold-storage"
import { formatTk } from "./pos-utils"

const HOLD_CARD_HEIGHT_PX = 90
const HOLD_CARD_GAP_PX = 8
const VISIBLE_HOLD_CARDS = 4
const HOLD_LIST_MAX_HEIGHT_PX =
  VISIBLE_HOLD_CARDS * HOLD_CARD_HEIGHT_PX +
  (VISIBLE_HOLD_CARDS - 1) * HOLD_CARD_GAP_PX

interface PosHeldTransactionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  holds: PosHeldTransaction[]
  onRecall: (hold: PosHeldTransaction) => void
  onDelete: (id: string) => void
  onRemoveAll?: () => void
}

export function PosHeldTransactionsDialog({
  open,
  onOpenChange,
  holds,
  onRecall,
  onDelete,
  onRemoveAll,
}: PosHeldTransactionsDialogProps) {
  const [removeAllConfirmOpen, setRemoveAllConfirmOpen] = useState(false)

  const handleConfirmRemoveAll = () => {
    onRemoveAll?.()
    setRemoveAllConfirmOpen(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Held transactions</DialogTitle>
          <DialogDescription>
            Resume a parked sale or remove it from the hold list.
          </DialogDescription>
        </DialogHeader>

        <div
          className="overflow-y-auto overscroll-contain py-1 pr-1"
          style={{ maxHeight: holds.length > 0 ? HOLD_LIST_MAX_HEIGHT_PX : undefined }}
        >
          {holds.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No held transactions yet.
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: HOLD_CARD_GAP_PX }}>
              {holds.map((hold) => {
              const itemCount = hold.items.reduce((sum, row) => sum + row.quantity, 0)
              const total = computeHeldTotal(hold)
              const customerLabel =
                hold.customer?.name?.trim() || "Walk-in customer"
              const heldLabel = format(new Date(hold.heldAt), "MMM d, h:mm a")

              return (
                <div
                  key={hold.id}
                  className="flex shrink-0 items-start gap-3 rounded-lg border border-[#f2f2f2] p-3"
                  style={{ minHeight: HOLD_CARD_HEIGHT_PX, height: HOLD_CARD_HEIGHT_PX }}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-[#333]">
                      {customerLabel}
                    </p>
                    <p className="text-xs text-[#666]">
                      {itemCount} item{itemCount === 1 ? "" : "s"} · {formatTk(total)}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-[#999]">
                      <Clock className="h-3 w-3 shrink-0" />
                      {heldLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => onRecall(hold)}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Recall
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => onDelete(hold.id)}
                     accessAction="delete">
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              )
              })}
            </div>
          )}
        </div>

        {holds.length > 0 && onRemoveAll && (
          <DialogFooter className="border-t border-[#f2f2f2] pt-3 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setRemoveAllConfirmOpen(true)}
             accessAction="delete">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Remove all
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={removeAllConfirmOpen} onOpenChange={setRemoveAllConfirmOpen}>
      <AlertDialogContent className="z-[60]">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove all held transactions?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {holds.length} held transaction{holds.length === 1 ? "" : "s"}
            </span>
            . You cannot undo this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={handleConfirmRemoveAll}
          >
            Remove all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
