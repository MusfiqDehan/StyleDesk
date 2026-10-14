"use client"

import { cn } from "@/lib/utils"

export type PosCatalogTab = "services" | "packages"

interface PosCatalogFilterProps {
  value: PosCatalogTab
  onChange: (value: PosCatalogTab) => void
  className?: string
}

export function PosCatalogFilter({ value, onChange, className }: PosCatalogFilterProps) {
  return (
    <div
      className={cn(
        "flex w-full shrink-0 items-center gap-1 rounded-xl border border-brand-line bg-brand-mist p-1 sm:w-auto",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("services")}
        className={cn(
          "flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:w-24 sm:flex-none",
          value === "services"
            ? "bg-white text-brand-primary shadow-sm"
            : "text-brand-muted hover:text-brand-ink",
        )}
      >
        Services
      </button>
      <button
        type="button"
        onClick={() => onChange("packages")}
        className={cn(
          "flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:w-24 sm:flex-none",
          value === "packages"
            ? "bg-white text-brand-primary shadow-sm"
            : "text-brand-muted hover:text-brand-ink",
        )}
      >
        Packages
      </button>
    </div>
  )
}
