"use client"

import { cn } from "@/lib/utils"

export interface RangeOption<T extends string> {
  value: T
  label: string
}

interface RangeToggleProps<T extends string> {
  value: T
  options: RangeOption<T>[]
  onChange: (value: T) => void
  className?: string
  size?: "sm" | "md"
}

export function RangeToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "sm",
}: RangeToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-mist)] p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-md font-medium transition-all",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              active
                ? "bg-white text-[#0076E9] shadow-sm ring-1 ring-[var(--brand-line)]"
                : "text-[var(--brand-muted)] hover:text-[var(--brand-ink)]",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
