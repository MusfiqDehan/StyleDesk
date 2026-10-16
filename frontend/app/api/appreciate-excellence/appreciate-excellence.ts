import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL = process.env.INTERNAL_API_BASE_URL || 'http://localhost:4000'

export async function getAppreciateExcellence() {
    try {
        const res = await tenantFetch(`${API_BASE_URL}/appreciate-excellence`, {
            next: {
                revalidate: 300
            }
        })

        if (!res.ok) {
            console.error(`Failed to fetch appreciate excellence: ${res.status} ${res.statusText}`)
            return null
        }
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        console.error("Error fetching appreciate excellence:", error)
        return null
    }
}
