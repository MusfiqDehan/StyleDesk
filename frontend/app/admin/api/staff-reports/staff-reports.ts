import { getCursorCollection } from "@/lib/pagination/collection"
export async function getStaffReports(from: string, to: string, noCache = false): Promise<any> {
  const result = await getCursorCollection('/reports/staff', { from, to, collection: 'staff', _sort: 'name', _order: 'asc' })
  return { ...result, staff: result.data }
}
