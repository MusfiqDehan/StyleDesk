"use client"

import { cn } from "@/lib/utils"

export interface CustomerPageHeaderChip {
  label: string
  value: string | number
}

interface CustomerPageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  chips?: CustomerPageHeaderChip[]
  actions?: React.ReactNode
  className?: string
}

export function CustomerPageHeader({
  eyebrow = "My Account",
  title,
  subtitle,
  chips,
  actions,
  className,
}: CustomerPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 overflow-hidden rounded-lg border border-[#eccd80]/20 bg-[#eccd80]/[0.03] shadow-[0_0_40px_rgba(236,205,128,0.04)]",
        className,
      )}
    >
      <div
        className="h-px bg-gradient-to-r from-transparent via-[#eccd80]/60 to-transparent"
        aria-hidden
      />

      <div className="px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#eccd80]">
              {eyebrow}
            </p>
            <div className="mt-3 flex items-start gap-3">
              <div
                className="mt-1 h-9 w-0.5 shrink-0 rounded-full bg-gradient-to-b from-[#eccd80] to-[#eccd80]/20"
                aria-hidden
              />
              <div className="min-w-0">
                <h1
                  className="text-2xl font-semibold text-white sm:text-[28px]"
                  style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 text-[12px] text-white/60 sm:text-[13px]">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {chips?.map((chip) => (
              <div key={chip.label} className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#eccd80]/80">
                  {chip.label}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#eccd80]">
                  {chip.value}
                </p>
              </div>
            ))}
            {actions}
          </div>
        </div>
      </div>

      <div
        className="h-px bg-gradient-to-r from-transparent via-[#eccd80]/25 to-transparent"
        aria-hidden
      />
    </header>
  )
}
