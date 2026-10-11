import api from '../base'
import { CACHE, asList, consumeStale, markStale } from '@admin/lib/cache'

const TTL = 10 * 60 * 1000 // 10 min — services rarely change

export async function getServices(filters?: { name?: string; category?: string; sortPrice?: string }, noCache = false) {
  const override = noCache || consumeStale(CACHE.SERVICES)
  const { data } = await api.get('/service', {
    id: CACHE.SERVICES,
    params: filters,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return asList(data)
}

export async function getActiveServices(noCache = false) {
  const override = noCache || consumeStale(CACHE.SERVICES_ACTIVE)
  const { data } = await api.get('/service/active', {
    id: CACHE.SERVICES_ACTIVE,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return asList(data)
}

export async function getServiceById(id: string) {
  const { data } = await api.get(`/service/${id}`, { cache: { ttl: TTL } })
  return data
}

import axios from 'axios'

// Create a raw axios instance for file uploads to avoid interceptor interference
const rawApi = axios.create({
  baseURL: api.defaults.baseURL,
  withCredentials: true,
})

export async function createService(serviceData: any) {
  const isFormData = serviceData instanceof FormData
  const { data } = await (isFormData ? rawApi : api).post('/service', serviceData, { 
    cache: false
  })
  markStale(CACHE.SERVICES, CACHE.SERVICES_ACTIVE, CACHE.DASHBOARD)
  return data
}

export async function updateService(id: string, serviceData: any) {
  const isFormData = serviceData instanceof FormData
  const { data } = await (isFormData ? rawApi : api).patch(`/service/${id}`, serviceData, { 
    cache: false
  })
  markStale(CACHE.SERVICES, CACHE.SERVICES_ACTIVE)
  return data
}

export async function deleteService(id: string) {
  const { data } = await api.delete(`/service/${id}`)
  markStale(CACHE.SERVICES, CACHE.SERVICES_ACTIVE, CACHE.DASHBOARD)
  return data
}
