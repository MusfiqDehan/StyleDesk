"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type InvoiceStatusFilterValue = "all" | "Paid" | "Partial" | "Unpaid" | "due"

interface InvoiceStatusFilterProps {
  value: InvoiceStatusFilterValue
  onChange: (value: InvoiceStatusFilterValue) => void
  className?: string
}

const OPTIONS: { value: InvoiceStatusFilterValue; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "Paid", label: "Paid" },
  { value: "Partial", label: "Partial" },
  { value: "Unpaid", label: "Unpaid" },
  { value: "due", label: "Due (Unpaid + Partial)" },
]

export function InvoiceStatusFilter({
  value,
  onChange,
  className,
}: InvoiceStatusFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as InvoiceStatusFilterValue)}>
      <SelectTrigger
        className={cn(
          "h-[38px] w-[180px] rounded-lg border border-[#e7e7e7] bg-white px-3",
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
