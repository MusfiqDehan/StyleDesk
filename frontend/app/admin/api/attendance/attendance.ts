import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base'

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'absent'

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  machineId: string
  deviceSerial: string | null
  attendanceDate: string
  checkInTime: string | null
  checkOutTime: string | null
  workingMinutes: number | null
  status: AttendanceStatus | null
  createdAt: string
}

export interface MonthSummary {
  from: string
  to: string
  total: number
  present: number
  late: number
  half_day: number
  absent: number
  no_exit: number
}

export interface FilterParams {
  date?: string
  month?: string | number
  year?: string | number
  employeeId?: string
  deviceSerial?: string
}

export async function getAttendance(params: FilterParams = {}): Promise<AttendanceRecord[]> {
  const { data } = await getCursorCollection<AttendanceRecord>('/attendance', params as Record<string, unknown>)
  return data
}

export async function getAttendanceDevices(): Promise<string[]> {
  const { data } = await api.get('/attendance/devices', { cache: false })
  return data
}

export async function getTodayAttendance(): Promise<AttendanceRecord[]> {
  const { data } = await getCursorCollection<AttendanceRecord>('/attendance/today')
  return data
}

export async function syncAttendanceNow(): Promise<void> {
  await api.post('/attendance/sync', {})
}

export async function reprocessAttendanceForDevice(deviceUid: string): Promise<void> {
  await api.post(`/attendance/reprocess/device/${encodeURIComponent(deviceUid)}`, {})
}

export async function suppressUnlinkedScan(deviceUid: string, attendanceDate: string): Promise<void> {
  await api.post(
    `/attendance/suppress/device/${encodeURIComponent(deviceUid)}/date/${encodeURIComponent(attendanceDate)}`,
    {},
  )
}

export async function getAttendanceSummary(year: number, month: number): Promise<MonthSummary> {
  const { data } = await api.get('/attendance/summary', { params: { year, month }, cache: false })
  return data
}

export async function updateAttendanceRecord(
  id: string,
  data: { checkInTime?: string | null; checkOutTime?: string | null; status?: AttendanceStatus | null },
): Promise<AttendanceRecord> {
  const { data: record } = await api.patch(`/attendance/${id}`, data)
  return record
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  await api.delete(`/attendance/${id}`)
}

export function formatWorkingTime(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  // Use Asia/Dhaka so it automatically adds the correct +6h offset from UTC.
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Dhaka',
  }).format(date)
}
