import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base'
import { CACHE, asList, clearCacheByPrefix, consumeStale, markStale } from '@admin/lib/cache'
import { isArtistEmployeeRole } from '@/lib/employee-roles'
import { markPayrollDirty } from '../hr-payroll/hr-payroll'

const TTL = 10 * 60 * 1000 // 10 min — employees rarely change

export async function getEmployees(noCache = false) {
  const override = noCache || consumeStale(CACHE.EMPLOYEES)
  const { data } = await getCursorCollection('/employee')
  return asList(data)
}

export async function getBasicEmployees(noCache = false) {
  const override = noCache || consumeStale(CACHE.EMPLOYEES_BASIC)
  const { data } = await api.get('/employee/basic', {
    id: CACHE.EMPLOYEES_BASIC,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return asList(data)
}

export async function getEmployeesFiltered(name?: string, noCache = false) {
  const override = noCache || consumeStale(CACHE.EMPLOYEES)
  const { data } = await getCursorCollection('/employee', { name })
  return asList(data)
}

export async function getStylists(noCache = false) {
  const override = noCache || consumeStale(CACHE.EMPLOYEES_STYLISTS)
  const { data } = await api.get('/employee/basic', {
    id: CACHE.EMPLOYEES_STYLISTS,
    cache: noCache ? false : { ttl: TTL, override },
  })
  return asList(data).filter((e: any) => isArtistEmployeeRole(e.role))
}

export async function getEmployeeById(id: string) {
  const { data } = await api.get(`/employee/${id}`, { cache: { ttl: TTL } })
  return data
}

export async function createEmployee(employeeData: any) {
  let payload = employeeData
  if (!(employeeData instanceof FormData)) {
    payload = new FormData()
    payload.append('data', JSON.stringify(employeeData))
  }

  const { data } = await api.post('/employee', payload)
  clearCacheByPrefix(CACHE.EMPLOYEES)
  clearCacheByPrefix(CACHE.EMPLOYEES_BASIC)
  clearCacheByPrefix(CACHE.EMPLOYEES_STYLISTS)
  markStale(
    CACHE.EMPLOYEES,
    CACHE.EMPLOYEES_BASIC,
    CACHE.EMPLOYEES_STYLISTS,
    CACHE.DASHBOARD,
    CACHE.STAFF_REPORTS,
    CACHE.PAYROLL,
  )
  markPayrollDirty()
  return data
}

export async function updateEmployee(id: string, employeeData: any) {
  let payload = employeeData
  if (!(employeeData instanceof FormData)) {
    payload = new FormData()
    payload.append('data', JSON.stringify(employeeData))
  }

  const { data } = await api.patch(`/employee/${id}`, payload)
  clearCacheByPrefix(CACHE.EMPLOYEES)
  clearCacheByPrefix(CACHE.EMPLOYEES_BASIC)
  clearCacheByPrefix(CACHE.EMPLOYEES_STYLISTS)
  markStale(
    CACHE.EMPLOYEES,
    CACHE.EMPLOYEES_BASIC,
    CACHE.EMPLOYEES_STYLISTS,
    CACHE.STAFF_REPORTS,
    CACHE.PAYROLL,
  )
  markPayrollDirty()
  return data
}

export async function deleteEmployee(id: string) {
  const { data } = await api.delete(`/employee/${id}`)
  clearCacheByPrefix(CACHE.EMPLOYEES)
  clearCacheByPrefix(CACHE.EMPLOYEES_BASIC)
  clearCacheByPrefix(CACHE.EMPLOYEES_STYLISTS)
  markStale(
    CACHE.EMPLOYEES,
    CACHE.EMPLOYEES_BASIC,
    CACHE.EMPLOYEES_STYLISTS,
    CACHE.DASHBOARD,
    CACHE.STAFF_REPORTS,
    CACHE.PAYROLL,
  )
  markPayrollDirty()
  return data
}
