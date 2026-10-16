/** Shared voucher domain helpers for the admin Voucher page. */

export type VoucherType = "Income" | "Expense"

export type VoucherDateRange =
  | "This Month"
  | "Last 3 Months"
  | "Last 6 Months"
  | "Last 1 Year"

export const VOUCHER_DATE_RANGES: VoucherDateRange[] = [
  "This Month",
  "Last 3 Months",
  "Last 6 Months",
  "Last 1 Year",
]

export const VOUCHER_PAGE_SIZE = 10

export interface Voucher {
  id: string
  voucherNo: string
  /** ISO date YYYY-MM-DD */
  date: string
  title: string
  description: string
  type: VoucherType
  /** Always positive; sign derived from type */
  amount: number
}

export interface VoucherKpiStats {
  totalVouchers: number
  totalIncome: number
  totalExpense: number
  netBalance: number
  /** Percent change vs previous equal-length period (negative = lower). */
  netBalanceChangePercent: number
  periodLabel: string
}

/** Asia/Dhaka business calendar date as YYYY-MM-DD. */
export function businessTodayStr(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function parseIso(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00+06:00`)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0)
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  next.setMonth(next.getMonth() + months)
  return next
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Inclusive [from, to] range for the selected preset (Asia/Dhaka “today”). */
export function getDateRangeBounds(
  range: VoucherDateRange,
  today = new Date(`${businessTodayStr()}T12:00:00+06:00`),
): { from: string; to: string } {
  const to = today
  const monthStart = startOfMonth(today)

  switch (range) {
    case "This Month":
      return { from: toIso(monthStart), to: toIso(to) }
    case "Last 3 Months":
      return { from: toIso(addMonths(monthStart, -2)), to: toIso(to) }
    case "Last 6 Months":
      return { from: toIso(addMonths(monthStart, -5)), to: toIso(to) }
    case "Last 1 Year":
      return { from: toIso(addMonths(monthStart, -11)), to: toIso(to) }
    default:
      return { from: toIso(monthStart), to: toIso(to) }
  }
}

/** Previous period of equal length, ending the day before `from`. */
export function getPreviousPeriodBounds(range: VoucherDateRange): { from: string; to: string } {
  const { from, to } = getDateRangeBounds(range)
  const fromD = parseIso(from)
  const toD = parseIso(to)
  const days = Math.round((toD.getTime() - fromD.getTime()) / 86_400_000) + 1
  const prevTo = new Date(fromD)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { from: toIso(prevFrom), to: toIso(prevTo) }
}

export function voucherInRange(date: string, from: string, to: string): boolean {
  const d = date.slice(0, 10)
  return d >= from && d <= to
}

export function formatVoucherDisplayDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-")
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

export function formatVoucherAmount(type: VoucherType, amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.abs(amount || 0),
  )
  return type === "Expense" ? `-Tk.${formatted}` : `+Tk.${formatted}`
}

export function computeVoucherKpis(
  vouchers: Voucher[],
  range: VoucherDateRange,
): VoucherKpiStats {
  const { from, to } = getDateRangeBounds(range)
  const current = vouchers.filter((v) => voucherInRange(v.date, from, to))

  const totalIncome = current
    .filter((v) => v.type === "Income")
    .reduce((s, v) => s + v.amount, 0)
  const totalExpense = current
    .filter((v) => v.type === "Expense")
    .reduce((s, v) => s + v.amount, 0)
  const netBalance = totalIncome - totalExpense

  const prev = getPreviousPeriodBounds(range)
  const previous = vouchers.filter((v) => voucherInRange(v.date, prev.from, prev.to))
  const prevNet =
    previous.filter((v) => v.type === "Income").reduce((s, v) => s + v.amount, 0) -
    previous.filter((v) => v.type === "Expense").reduce((s, v) => s + v.amount, 0)

  let netBalanceChangePercent = 0
  if (prevNet !== 0) {
    netBalanceChangePercent = Math.round(((netBalance - prevNet) / Math.abs(prevNet)) * 100)
  } else if (netBalance !== 0) {
    netBalanceChangePercent = netBalance > 0 ? 100 : -100
  }

  return {
    totalVouchers: current.length,
    totalIncome,
    totalExpense,
    netBalance,
    netBalanceChangePercent,
    periodLabel: range,
  }
}

/** Seed demo vouchers spanning ~12 months so date filters are meaningful. */
export function createDemoVouchers(): Voucher[] {
  const today = parseIso(businessTodayStr())
  const seeds: Array<Omit<Voucher, "id" | "voucherNo" | "date"> & { monthsAgo: number; day: number }> = [
    { monthsAgo: 0, day: 11, title: "Electricity Bill", description: "Electricity Bill (April)", type: "Expense", amount: 12_000 },
    { monthsAgo: 0, day: 8, title: "Membership Signup-Sinha Mifta", description: "Membership Signup-Sinha Mifta", type: "Income", amount: 9_400 },
    { monthsAgo: 0, day: 5, title: "POS Daily Collection", description: "Walk-in salon services (POS)", type: "Income", amount: 48_500 },
    { monthsAgo: 0, day: 3, title: "Product Sale", description: "Retail haircare products", type: "Income", amount: 6_200 },
    { monthsAgo: 1, day: 9, title: "Electricity Bill", description: "Electricity Bill", type: "Expense", amount: 12_000 },
    { monthsAgo: 1, day: 8, title: "Inventory Purchase", description: "Inventory Purchase Skin Care Product", type: "Expense", amount: 18_400 },
    { monthsAgo: 1, day: 8, title: "Banani Branch Rent", description: "Banani Branch Rent (March)", type: "Expense", amount: 60_000 },
    { monthsAgo: 1, day: 7, title: "Staff Salary Payment", description: "Staff Salary Payment", type: "Expense", amount: 97_000 },
    { monthsAgo: 1, day: 15, title: "Package Booking", description: "Bridal package advance", type: "Income", amount: 35_000 },
    { monthsAgo: 2, day: 12, title: "Water Bill", description: "WASA monthly bill", type: "Expense", amount: 3_500 },
    { monthsAgo: 2, day: 20, title: "Membership Renewal", description: "Annual membership renewals", type: "Income", amount: 28_000 },
    { monthsAgo: 3, day: 4, title: "Marketing Ads", description: "Facebook / Instagram ads", type: "Expense", amount: 15_000 },
    { monthsAgo: 3, day: 18, title: "Spa Package Sale", description: "Weekend spa package sales", type: "Income", amount: 42_000 },
    { monthsAgo: 4, day: 10, title: "Equipment Repair", description: "Chair hydraulic repair", type: "Expense", amount: 8_500 },
    { monthsAgo: 4, day: 22, title: "Gift Card Sales", description: "Festival gift card sales", type: "Income", amount: 19_800 },
    { monthsAgo: 5, day: 6, title: "Internet Bill", description: "Office ISP (6 months)", type: "Expense", amount: 7_200 },
    { monthsAgo: 5, day: 14, title: "Walk-in Services", description: "Cash collection batch", type: "Income", amount: 31_200 },
    { monthsAgo: 6, day: 9, title: "Uniform Purchase", description: "Staff uniforms restock", type: "Expense", amount: 11_000 },
    { monthsAgo: 6, day: 25, title: "Corporate Booking", description: "Office gala styling", type: "Income", amount: 55_000 },
    { monthsAgo: 7, day: 3, title: "Cleaning Supplies", description: "Sanitizer and towels", type: "Expense", amount: 4_800 },
    { monthsAgo: 8, day: 16, title: "Training Workshop", description: "Staff skill training fee", type: "Expense", amount: 22_000 },
    { monthsAgo: 8, day: 28, title: "Makeover Package", description: "Eid makeover packages", type: "Income", amount: 67_500 },
    { monthsAgo: 9, day: 11, title: "AC Maintenance", description: "Annual AC service", type: "Expense", amount: 9_600 },
    { monthsAgo: 10, day: 5, title: "Client Deposits", description: "Advance deposits cleared", type: "Income", amount: 24_000 },
    { monthsAgo: 11, day: 19, title: "Year-End Bonus", description: "Staff year-end bonus", type: "Expense", amount: 40_000 },
    { monthsAgo: 11, day: 27, title: "Holiday Bookings", description: "Holiday peak bookings", type: "Income", amount: 52_300 },
  ]

  return seeds
    .map((s, index) => {
      const d = addMonths(startOfMonth(today), -s.monthsAgo)
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(s.day, lastDay))
      const iso = toIso(d)
      const seq = String(seeds.length - index).padStart(3, "0")
      return {
        id: `voucher-${index + 1}`,
        voucherNo: `V-${d.getFullYear()}-${seq}`,
        date: iso,
        title: s.title,
        description: s.description,
        type: s.type,
        amount: s.amount,
      } satisfies Voucher
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.voucherNo < b.voucherNo ? 1 : -1))
}
