import api from '../base'
import { CACHE, asList, consumeStale, markStale } from '@admin/lib/cache'

export async function uploadPackageImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/makeover-packages/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.imageUrl
}

const TTL = 5 * 60 * 1000 // 5 min

export async function getPackages(noCache = false) {
  const override = noCache || consumeStale(CACHE.PACKAGES)
  const { data } = await api.get('/makeover-packages', { 
    id: CACHE.PACKAGES, 
    cache: noCache ? false : { ttl: TTL, override } 
  })
  return asList(data)
}

export async function getPackageById(id: string) {
  const { data } = await api.get(`/makeover-packages/${id}`, { 
    cache: { ttl: TTL } 
  })
  return data
}

export async function createPackage(packageData: any) {
  const { data } = await api.post('/makeover-packages', packageData)
  markStale(CACHE.PACKAGES)
  return data
}

export async function updatePackage(id: string, packageData: any) {
  const { data } = await api.patch(`/makeover-packages/${id}`, packageData)
  markStale(CACHE.PACKAGES)
  return data
}

export async function deletePackage(id: string) {
  const { data } = await api.delete(`/makeover-packages/${id}`)
  markStale(CACHE.PACKAGES)
  return data
}

export async function bookPackage(id: string, bookingData: any) {
  const { data } = await api.post(`/makeover-packages/book/${id}`, bookingData)
  // No need to stale packages cache for booking
  return data
}
