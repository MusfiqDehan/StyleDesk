"use client"

import { useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface PosSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function PosSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: PosSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div
      className={cn(
        "relative flex h-[42px] w-full flex-1 items-center overflow-hidden rounded-xl border border-brand-line bg-white sm:h-[38px]",
        className
      )}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-brand-muted" />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent pl-9 pr-3 text-sm font-medium text-brand-ink outline-none placeholder:text-brand-muted sm:pr-12"
      />
      <span className="pointer-events-none absolute right-1.5 top-1/2 hidden size-7 -translate-y-1/2 items-center justify-center rounded-lg bg-brand-mist text-xs font-medium text-brand-muted sm:flex">
        ⌘K
      </span>
    </div>
  )
}
