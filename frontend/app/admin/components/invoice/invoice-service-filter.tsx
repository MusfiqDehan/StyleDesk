"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type InvoiceCatalogFilterValue = {
  categories: string[]
  services: string[]
  packages: string[]
}

export const EMPTY_CATALOG_FILTER: InvoiceCatalogFilterValue = {
  categories: [],
  services: [],
  packages: [],
}

export function isCatalogFilterActive(value: InvoiceCatalogFilterValue) {
  return (
    value.categories.length > 0 ||
    value.services.length > 0 ||
    value.packages.length > 0
  )
}

interface ServiceOption {
  name: string
  category: string
}

interface PackageOption {
  name: string
}

interface InvoiceServiceFilterProps {
  value: InvoiceCatalogFilterValue
  onChange: (value: InvoiceCatalogFilterValue) => void
  serviceOptions: ServiceOption[]
  packageOptions?: PackageOption[]
  className?: string
}

function toggleInList(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function InvoiceServiceFilter({
  value,
  onChange,
  serviceOptions,
  packageOptions = [],
  className,
}: InvoiceServiceFilterProps) {
  const [open, setOpen] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const s of serviceOptions) {
      const cat = String(s.category || "").trim()
      if (cat) set.add(cat)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [serviceOptions])

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of serviceOptions) {
      const name = String(s.name || "").trim()
      if (!name) continue
      const cat = String(s.category || "").trim() || "Other"
      const list = map.get(cat) ?? []
      if (!list.includes(name)) list.push(name)
      map.set(cat, list)
    }
    for (const [cat, list] of map) {
      map.set(
        cat,
        [...list].sort((a, b) => a.localeCompare(b)),
      )
    }
    return map
  }, [serviceOptions])

  const packageNames = useMemo(
    () =>
      [...new Set(packageOptions.map((p) => String(p.name || "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [packageOptions],
  )

  const selectedCount =
    value.categories.length + value.services.length + value.packages.length

  const label =
    selectedCount === 0
      ? "All Services"
      : selectedCount === 1
        ? value.categories[0] || value.services[0] || value.packages[0]
        : `${selectedCount} selected`

  const toggleCategory = (category: string) => {
    onChange({
      ...value,
      categories: toggleInList(value.categories, category),
    })
  }

  const toggleService = (name: string) => {
    onChange({
      ...value,
      services: toggleInList(value.services, name),
    })
  }

  const togglePackage = (name: string) => {
    onChange({
      ...value,
      packages: toggleInList(value.packages, name),
    })
  }

  const clearAll = () => onChange(EMPTY_CATALOG_FILTER)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-[38px] min-w-[180px] max-w-[240px] items-center justify-between gap-2 rounded-lg border border-[#e7e7e7] bg-white px-3",
            "text-sm font-medium text-[#333] shadow-none",
            "hover:border-[#cfd8e3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20",
            selectedCount > 0 && "border-brand-primary/40 bg-brand-mist",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-[#666]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] rounded-xl border border-[#e7e7e7] p-0 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#f2f2f2] px-3 py-2.5">
          <p className="text-sm font-semibold text-[#333]">Filter by service</p>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {categories.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                Categories
              </p>
              <ul className="space-y-0.5">
                {categories.map((cat) => {
                  const checked = value.categories.includes(cat)
                  return (
                    <li key={`cat-${cat}`}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#333] hover:bg-brand-mist",
                          checked && "bg-brand-mist",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-[#cfd8e3] bg-white",
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </span>
                        <span className="truncate font-medium">{cat}</span>
                        <span className="ml-auto text-[11px] text-[#999]">
                          {servicesByCategory.get(cat)?.length ?? 0}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {categories.map((cat) => {
            const services = servicesByCategory.get(cat) ?? []
            if (services.length === 0) return null
            return (
              <div key={`svc-group-${cat}`} className="mb-2">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                  {cat} services
                </p>
                <ul className="space-y-0.5">
                  {services.map((name) => {
                    const checked = value.services.includes(name)
                    return (
                      <li key={`svc-${cat}-${name}`}>
                        <button
                          type="button"
                          onClick={() => toggleService(name)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#333] hover:bg-brand-mist",
                            checked && "bg-brand-mist",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border",
                              checked
                                ? "border-brand-primary bg-brand-primary text-white"
                                : "border-[#cfd8e3] bg-white",
                            )}
                          >
                            {checked ? <Check className="size-3" /> : null}
                          </span>
                          <span className="truncate">{name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}

          {packageNames.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                Packages
              </p>
              <ul className="space-y-0.5">
                {packageNames.map((name) => {
                  const checked = value.packages.includes(name)
                  return (
                    <li key={`pkg-${name}`}>
                      <button
                        type="button"
                        onClick={() => togglePackage(name)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#333] hover:bg-brand-mist",
                          checked && "bg-brand-mist",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-[#cfd8e3] bg-white",
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </span>
                        <span className="truncate">{name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {categories.length === 0 && packageNames.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-[#888]">
              No services or packages found
            </p>
          )}
        </div>

        <div className="border-t border-[#f2f2f2] p-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Match invoice if it includes any selected service, package, or category (OR). */
export function invoiceMatchesCatalogFilter(
  invoice: { services: string[]; packageNames?: string[] },
  filter: InvoiceCatalogFilterValue,
  serviceOptions: ServiceOption[],
): boolean {
  if (!isCatalogFilterActive(filter)) return true

  const lineServices = (invoice.services ?? [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
  const linePackages = (invoice.packageNames ?? [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)

  if (filter.services.some((name) => lineServices.includes(name))) return true
  if (filter.packages.some((name) => linePackages.includes(name))) return true

  if (filter.categories.length > 0) {
    const nameToCategory = new Map(
      serviceOptions.map((s) => [
        String(s.name || "").trim().toLowerCase(),
        String(s.category || "").trim(),
      ]),
    )
    for (const svc of lineServices) {
      const cat = nameToCategory.get(svc.toLowerCase())
      if (cat && filter.categories.includes(cat)) return true
    }
  }

  return false
}
