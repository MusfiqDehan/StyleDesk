"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, UserPlus, X } from "lucide-react"
import { getClients } from "@admin/api/clients/clients"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import {
  type PosCustomer,
  type PosVisitType,
} from "./pos-utils"

function mapPosClient(c: any): PosCustomer {
  return {
    id: c.id,
    name: c.name ?? "Walk-in",
    phone: c.phone ?? "",
    points: Number(c.loyaltyPoints ?? c.points ?? 0) || 0,
    discountPercent: Number(c.discountPercent ?? 0) || 0,
  }
}

interface PosCustomerDetailsProps {
  customer: PosCustomer | null
  visitType: PosVisitType
  /** Bump to force a fresh clients fetch */
  clientsRefreshKey?: number
  onSelectCustomer: (customer: PosCustomer | null) => void
  onVisitTypeChange: (type: PosVisitType) => void
  onAddCustomer?: () => void
  className?: string
}

export function PosCustomerDetails({
  customer,
  visitType,
  clientsRefreshKey = 0,
  onSelectCustomer,
  onVisitTypeChange,
  onAddCustomer,
  className,
}: PosCustomerDetailsProps) {
  const [search, setSearch] = useState("")
  const [openResults, setOpenResults] = useState(false)
  const [clients, setClients] = useState<PosCustomer[]>([])
  const [visitOpen, setVisitOpen] = useState(false)
  const debouncedSearch = useDebounce(search, 250)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getClients(1, 200, true)
      .then((res: any) => {
        if (cancelled) return
        const list = Array.isArray(res) ? res : (res?.data ?? [])
        setClients(list.map(mapPosClient))
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [clientsRefreshKey])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenResults(false)
        setVisitOpen(false)
      }
    }
    window.addEventListener("mousedown", onPointerDown)
    return () => window.removeEventListener("mousedown", onPointerDown)
  }, [])

  const results = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return []
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      )
      .slice(0, 8)
  }, [clients, debouncedSearch])

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col gap-2 border-b-[1.5px] border-dashed border-brand-line pb-2.5",
        className,
      )}
    >
      <h3 className="text-[15px] font-semibold text-brand-ink">Customer Details</h3>

      <div className="relative flex w-full flex-col gap-2">
        {customer ? (
          <div className="relative flex min-h-8 w-full items-start rounded-xl border border-brand-line bg-white px-2 py-1.5 sm:items-center sm:overflow-hidden sm:py-0 sm:h-8">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden pr-6">
              <span className="max-w-full truncate text-xs font-medium text-brand-muted">{customer.name}</span>
              <span className="shrink-0 text-xs font-medium text-brand-muted">{customer.phone}</span>
              {(customer.points ?? 0) > 0 && (
                <span className="shrink-0 rounded-md bg-brand-mist px-2 py-0.5 text-xs font-medium text-brand-primary">
                  {customer.points} Points
                </span>
              )}
              {(customer.discountPercent ?? 0) > 0 && (
                <span className="shrink-0 rounded-md bg-brand-mist px-2 py-0.5 text-xs font-medium text-brand-primary">
                  {customer.discountPercent}%
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectCustomer(null)}
              className="absolute right-2 top-2 text-red-500 hover:text-red-600 sm:top-1/2 sm:-translate-y-1/2"
              aria-label="Clear customer"
            >
              <X className="size-3" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setOpenResults(true)
              }}
              onFocus={() => setOpenResults(true)}
              placeholder="Search customer by name"
              className="h-8 w-full rounded-xl border border-brand-line px-2 text-xs text-brand-ink outline-none placeholder:text-brand-muted"
            />
            {openResults && results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-brand-line bg-white shadow-lg">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-xs text-brand-ink hover:bg-brand-mist"
                      onClick={() => {
                        onSelectCustomer(item)
                        setSearch("")
                        setOpenResults(false)
                      }}
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="shrink-0 text-[#666]">{item.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setVisitOpen((v) => !v)}
              className="flex h-8 w-full items-center justify-between rounded-xl border border-brand-line bg-white px-2 text-left"
            >
              <span className="text-xs text-brand-muted sm:text-[13px]">
                {visitType === "walk-in" ? "Walk In" : "Online"}
              </span>
              <ChevronDown className="size-4 text-brand-muted" />
            </button>
            {visitOpen && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-brand-line bg-white shadow-lg">
                {(
                  [
                    { value: "walk-in", label: "Walk In" },
                    { value: "online", label: "Online" },
                  ] as const
                ).map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      className="w-full px-2 py-2 text-left text-xs text-brand-ink hover:bg-brand-mist"
                      onClick={() => {
                        onVisitTypeChange(opt.value)
                        setVisitOpen(false)
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={onAddCustomer}
            className="flex h-8 shrink-0 items-center gap-1 rounded-xl border border-brand-line px-2 text-xs font-medium text-brand-primary hover:bg-brand-mist"
          >
            <UserPlus className="size-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
