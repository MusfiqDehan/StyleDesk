"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type InvoiceDateFilterValue = "all" | "today" | "month" | "6months" | "year"

interface InvoiceDateFilterProps {
  value: InvoiceDateFilterValue
  onChange: (value: InvoiceDateFilterValue) => void
  className?: string
}

const OPTIONS: { value: InvoiceDateFilterValue; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "month", label: "This Month" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "Last 1 Year" },
]

export function InvoiceDateFilter({
  value,
  onChange,
  className,
}: InvoiceDateFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as InvoiceDateFilterValue)}
    >
      <SelectTrigger
        className={cn(
          "h-[38px] w-[160px] rounded-lg border border-[#e7e7e7] bg-white px-3",
          "text-sm font-medium text-[#333] shadow-none",
          "focus:ring-2 focus:ring-brand-primary/20 focus:ring-offset-0",
          "hover:border-[#cfd8e3] [&>svg]:text-[#666]",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
