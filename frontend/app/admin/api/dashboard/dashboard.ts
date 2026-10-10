import { getCursorCollection } from "@/lib/pagination/collection"
export async function getDashboardStats(noCache = false) {
  const endpoint = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/manager') ? '/manager-dashboard' : '/dashboard'
  const result = await getCursorCollection(endpoint, { collection: 'todaysAppointments' })
  return { ...result, todaysAppointments: result.data }
}
