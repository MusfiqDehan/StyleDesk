import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base'

export interface DeviceUser {
  id: string
  deviceUid: string
  deviceSerial: string | null
  name: string | null
  linkedEmployeeId: string | null
  status: 'unlinked' | 'linked'
  createdAt: string
}

export interface DeviceStatus {
  connected: boolean
  enabled: boolean
  cloudSn?: string | null
}

export async function getUnlinkedDeviceUsers(): Promise<DeviceUser[]> {
  const { data } = await getCursorCollection('/device-users/unlinked')
  return data
}

export async function getAllDeviceUsers(): Promise<DeviceUser[]> {
  const { data } = await getCursorCollection('/device-users')
  return data
}

export async function linkDeviceUser(device_uid: string, employee_id: string): Promise<DeviceUser> {
  const { data } = await api.post('/device-users/link', { device_uid, employee_id })
  return data
}

export async function unlinkDeviceUser(deviceUid: string): Promise<DeviceUser> {
  const { data } = await api.delete(`/device-users/${deviceUid}/unlink`)
  return data
}

export async function getDeviceStatus(): Promise<DeviceStatus> {
  const { data } = await api.get('/device-users/status', { cache: false })
  return data
}

export async function deleteDeviceUser(deviceUid: string): Promise<void> {
  await api.delete(`/device-users/${deviceUid}`)
}

export async function deleteAllDeviceUsers(): Promise<{ deleted: number; failed: number }> {
  const { data } = await api.delete('/device-users')
  return data
}

export async function syncDeviceUsers(): Promise<void> {
  await api.post('/device-users/sync', {})
}

export async function enrollEmployeeFingerprint(employee_id: string): Promise<{
  deviceUid: string
  employeeId: string
  status: 'waiting'
  message: string
}> {
  const { data } = await api.post('/device-users/enroll', { employee_id })
  return data
}

export async function removeEmployeeFingerprint(employee_id: string): Promise<{
  employeeId: string
  removedUid: string | null
}> {
  const { data } = await api.post('/device-users/remove-fingerprint', { employee_id })
  return data
}

export async function simulateDeviceUser(device_uid: string, name?: string): Promise<DeviceUser> {
  const { data } = await api.post('/device-users/simulate', { device_uid, name })
  return data
}
