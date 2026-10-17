import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ||
  "http://localhost:4000"

export type WhyChooseUsImages = [
  string | null,
  string | null,
  string | null,
  string | null,
]

export async function getWhyChooseUsImages(): Promise<WhyChooseUsImages> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/why-choose-us-image`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return [null, null, null, null]
    const data = await res.json()
    return [
      data?.image1 || null,
      data?.image2 || null,
      data?.image3 || null,
      data?.image4 || null,
    ]
  } catch {
    return [null, null, null, null]
  }
}
