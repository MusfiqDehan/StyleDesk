"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface InvoiceSearchProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function InvoiceSearch({ value, onChange, className }: InvoiceSearchProps) {
  return (
    <div className={cn("relative min-w-[240px] flex-1 max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by invoice, name or phone"
        className="h-[38px] w-full rounded-lg border border-[#e7e7e7] bg-white pl-9 pr-3 text-sm text-[#333] outline-none placeholder:text-[#999] shadow-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      />
    </div>
  )
}
