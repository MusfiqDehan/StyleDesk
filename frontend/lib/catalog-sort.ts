export type CatalogSortOrder = "newest" | "oldest" | "price_high" | "price_low"

export const CATALOG_SORT_OPTIONS: { value: CatalogSortOrder; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "price_low", label: "Price: Low to High" },
]

export function normalizeCatalogSort(value?: string | null): CatalogSortOrder {
  if (
    value === "newest" ||
    value === "oldest" ||
    value === "price_high" ||
    value === "price_low"
  ) {
    return value
  }
  return "newest"
}

/** Sort packages/services for admin tables and public catalog pages. */
export function sortCatalogItems<T extends { price?: number | string; createdAt?: string | Date | null }>(
  items: T[],
  sort: CatalogSortOrder,
): T[] {
  const list = [...items]
  const priceOf = (item: T) => Number(item.price) || 0
  const timeOf = (item: T) => {
    if (!item.createdAt) return 0
    const ms = new Date(item.createdAt).getTime()
    return Number.isFinite(ms) ? ms : 0
  }

  switch (sort) {
    case "oldest":
      return list.sort((a, b) => timeOf(a) - timeOf(b))
    case "price_high":
      return list.sort((a, b) => priceOf(b) - priceOf(a))
    case "price_low":
      return list.sort((a, b) => priceOf(a) - priceOf(b))
    case "newest":
    default:
      return list.sort((a, b) => timeOf(b) - timeOf(a))
  }
}
