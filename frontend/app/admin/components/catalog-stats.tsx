import { Layers, CircleCheck, Tags, Banknote } from "lucide-react"
import { DashKpiCard, DashKpiGrid } from "./dash/kpi-card"
import { formatCurrency } from "@/lib/utils"

interface CatalogItem { price: number; category: string; active?: boolean; popular?: boolean }

export function CatalogStats({ items, loading, kind }: {
  items: CatalogItem[]
  loading: boolean
  kind: "services" | "packages"
}) {
  const value = (count: number | string) => loading ? "..." : count
  const average = items.length ? items.reduce((sum, item) => sum + Number(item.price || 0), 0) / items.length : 0
  return (
    <DashKpiGrid className="mb-6" >
      <DashKpiCard title={kind === "services" ? "Matching services" : "Matching packages"} value={value(items.length)} subtitle="Current search and filters" icon={Layers} />
      <DashKpiCard title={kind === "services" ? "Active services" : "Popular packages"} value={value(items.filter((item) => kind === "services" ? item.active : item.popular).length)} subtitle="In matching results" icon={CircleCheck} tone="success" />
      <DashKpiCard title="Categories" value={value(new Set(items.map((item) => item.category)).size)} subtitle="In matching results" icon={Tags} tone="neutral" />
      <DashKpiCard title="Average price" value={value(formatCurrency(average))} subtitle="In matching results" icon={Banknote} tone="warning" />
    </DashKpiGrid>
  )
}
