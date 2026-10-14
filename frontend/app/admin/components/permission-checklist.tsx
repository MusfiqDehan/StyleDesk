"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { PermissionGroup } from "@admin/lib/permission-catalog"

interface PermissionChecklistProps {
  groups: PermissionGroup[]
  selected: string[]
  onToggle: (id: string) => void
  onToggleGroup?: (ids: string[], nextChecked: boolean) => void
  disabledIds?: string[]
  compact?: boolean
}

export function PermissionChecklist({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  disabledIds = [],
  compact = false,
}: PermissionChecklistProps) {
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const enabledIds = group.items
          .map((item) => item.id)
          .filter((id) => !disabledIds.includes(id))
                const checkedCount = enabledIds.filter((id) => selected.includes(id)).length
                const allOn = enabledIds.length > 0 && checkedCount === enabledIds.length

        return (
          <section key={group.title}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.title}
              </h3>
              {onToggleGroup && enabledIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => onToggleGroup(enabledIds, !allOn)}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  {allOn ? "Clear group" : "Allow all"}
                </button>
              )}
            </div>
            <div
              className={cn(
                "grid gap-2",
                compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {group.items.map((item) => {
                const checked = selected.includes(item.id)
                const disabled = disabledIds.includes(item.id)
                return (
                  <label
                    key={`${item.id}:${item.label}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      disabled && "cursor-not-allowed opacity-50",
                      checked
                        ? "border-primary/35 bg-primary/8"
                        : "border-border bg-white hover:border-primary/25 hover:bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => {
                        if (!disabled) onToggle(item.id)
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      {item.pages?.length ? (
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                          Unlocks {item.pages.join(", ")}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
