"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { getActiveServices } from "@admin/api/services/services"
import { getPackages } from "@admin/api/packages/packages"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { PosSearch } from "./pos-search"
import { PosCatalogFilter, type PosCatalogTab } from "./pos-catalog-filter"
import { PosServiceCard, type PosServiceCardData } from "./pos-service-card"
import { PosPackageCard, type PosPackageCardData } from "./pos-package-card"
import { PosCollectionSummary } from "./pos-collection-summary"

const DESKTOP_PAGE_SIZE = 9 // 3×3 grid
const MOBILE_PAGE_SIZE = 8 // 2×4 grid

interface PosChooseServicePanelProps {
  className?: string
  selectedServiceId?: string | null
  selectedPackageId?: string | null
  onSelectService?: (service: PosServiceCardData) => void
  onSelectPackage?: (packageItem: PosPackageCardData) => void
}

function normalizeList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) return data
  }
  return []
}

export function PosChooseServicePanel({
  className,
  selectedServiceId,
  selectedPackageId,
  onSelectService,
  onSelectPackage,
}: PosChooseServicePanelProps) {
  const [tab, setTab] = useState<PosCatalogTab>("services")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 200)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DESKTOP_PAGE_SIZE)
  const [services, setServices] = useState<PosServiceCardData[]>([])
  const [packages, setPackages] = useState<PosPackageCardData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const sync = () => setPageSize(mq.matches ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [servicesRes, packagesRes] = await Promise.all([
          getActiveServices(true),
          getPackages(true),
        ])

        if (cancelled) return

        const serviceList = normalizeList(servicesRes)
        const packageList = normalizeList(packagesRes)

        setServices(
          serviceList.map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? "").trim(),
            category: String(s.category ?? "").trim(),
            price: Number(s.price) || 0,
            imageUrl: s.imageUrl,
            count: Number(s.bookingCount ?? 0) || 0,
          })).filter((s: PosServiceCardData) => Boolean(s.id && s.name)),
        )

        setPackages(
          packageList.map((p: any) => ({
            id: String(p.id),
            title: String(p.title ?? p.name ?? "").trim(),
            category: String(p.category ?? "").trim(),
            price: Number(p.price) || 0,
            imageUrl: p.imageUrl,
            count: Number(p.bookingCount ?? 0) || 0,
          })).filter((p: PosPackageCardData) => Boolean(p.id && p.title)),
        )
      } catch (err) {
        console.error("Failed to load POS catalog:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Reset page when search, tab, or page size changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, tab, pageSize])

  const filteredServices = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) => {
      const name = s.name.toLowerCase()
      const category = (s.category || "").toLowerCase()
      return name.includes(q) || category.includes(q)
    })
  }, [services, debouncedSearch])

  const filteredPackages = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return packages
    return packages.filter((p) => {
      const title = p.title.toLowerCase()
      const category = (p.category || "").toLowerCase()
      return title.includes(q) || category.includes(q)
    })
  }, [packages, debouncedSearch])

  const title = tab === "services" ? "Choose A Service" : "Choose A Package"
  const filteredItems = tab === "services" ? filteredServices : filteredPackages
  const totalEntries = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageItems = filteredItems.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  )

  const handleTabChange = (next: PosCatalogTab) => {
    setTab(next)
    setSearch("")
    setPage(1)
  }

  const from = totalEntries === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalEntries)

  return (
    <section
      className={cn(
        "flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl border border-brand-line bg-white xl:min-h-[560px]",
        className,
      )}
    >
      <div className="shrink-0 space-y-3 p-3 pb-2 sm:space-y-4 sm:p-[19px] sm:pb-3">
        <h2 className="text-base font-semibold text-brand-ink sm:text-lg">{title}</h2>
        <div className="flex w-full flex-wrap items-center gap-3">
          <PosSearch
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder={
              tab === "services" ? "Search services…" : "Search packages…"
            }
            className="min-w-0 max-w-full flex-[1_1_220px]"
          />
          <PosCatalogFilter value={tab} onChange={handleTabChange} className="lg:w-auto" />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-[19px]">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-brand-muted">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : totalEntries === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-brand-muted">
            {debouncedSearch.trim()
              ? `No ${tab === "services" ? "services" : "packages"} match “${debouncedSearch.trim()}”`
              : `No ${tab === "services" ? "services" : "packages"} found`}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
            {tab === "services"
              ? (pageItems as PosServiceCardData[]).map((service) => (
                  <PosServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedServiceId === service.id}
                    onSelect={onSelectService}
                  />
                ))
              : (pageItems as PosPackageCardData[]).map((pkg) => (
                  <PosPackageCard
                    key={pkg.id}
                    packageItem={pkg}
                    selected={selectedPackageId === pkg.id}
                    onSelect={onSelectPackage}
                  />
                ))}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-brand-line bg-brand-mist/40 px-3 py-2.5 sm:px-[19px]">
        <PosCollectionSummary />

        {!loading && totalEntries > 0 && (
          <div className="flex flex-col gap-2 text-xs text-brand-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate">
              Showing {from}–{to} of {totalEntries}
              {totalPages > 1 ? ` · Page ${safePage}/${totalPages}` : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-brand-line bg-white px-2.5 text-xs font-medium text-brand-ink hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-brand-line bg-white px-2.5 text-xs font-medium text-brand-ink hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
