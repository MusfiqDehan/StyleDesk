import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL = process.env.INTERNAL_API_BASE_URL || 'http://localhost:4000'

export async function getActiveServices() {
    try {
        const res = await tenantFetch(`${API_BASE_URL}/service/active`, {
            next: {
                revalidate: 300
            }
        })

        if (!res.ok) {
            console.error(`Failed to fetch active services: ${res.status} ${res.statusText}`)
            return []
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
    } catch (error) {
        console.error("Error fetching active services:", error)
        return []
    }
}
