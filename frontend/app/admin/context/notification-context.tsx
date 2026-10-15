'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from '@/lib/toast'
import { getAppointments } from '@admin/api/appointments/appointments'
import { formatCurrency } from '@/lib/utils'
import { markBookingUnread } from '@admin/lib/booking-unread'
import { markInvoiceUnread } from '@admin/lib/invoice-unread'
import { getSocketConnection } from '@admin/lib/socket'
import { CACHE, markStale } from '@admin/lib/cache'
import { AdminAccessContext } from '@admin/lib/access-context'
import { canAccessPath } from '@admin/lib/auth-utils'

export interface NewAppointmentPayload {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  time: string
  services: string[]
  status: string
  createdAt: string
  source?: string
  isPackage?: boolean
  packageName?: string | null
  totalAmount?: number
}

interface NotificationContextValue {
  notifications: NewAppointmentPayload[]
  unreadCount: number
  markAllRead: () => void
  clearAll: () => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  clearAll: () => {},
  removeNotification: () => {},
})

export function useNotificationContext() {
  return useContext(NotificationContext)
}

function normalizePayload(data: any): NewAppointmentPayload {
  return {
    id: data.id,
    clientName: data.client?.name ?? data.clientName ?? 'Guest',
    phoneNumber: data.phoneNumber ?? '',
    date: data.date ?? '',
    time: data.time ?? '',
    services: Array.isArray(data.services) ? data.services : [],
    status: data.status ?? 'Pending',
    createdAt: data.createdAt ?? new Date().toISOString(),
    source: data.source ?? 'Online',
    isPackage: Boolean(data.isPackage),
    packageName: data.packageName ?? null,
    totalAmount: Number(data.totalAmount ?? 0) || 0,
  }
}

function bookingSummary(data: NewAppointmentPayload) {
  const parts: string[] = []
  if (data.packageName) parts.push(data.packageName)
  const catalogish = (data.services || []).filter(Boolean).slice(0, 2)
  if (catalogish.length && !data.isPackage) parts.push(catalogish.join(', '))
  else if (catalogish.length && data.isPackage && parts.length === 0) parts.push(catalogish[0])
  return parts.join(' · ') || 'New booking request'
}

function showBookingToast(data: NewAppointmentPayload) {
  const total =
    Number(data.totalAmount) > 0 ? formatCurrency(data.totalAmount) : null
  toast.custom(
    (t) => (
      <div
        className="w-[min(100vw-2rem,380px)] rounded-xl border border-[#e7e7e7] bg-white p-4 shadow-xl"
        onClick={() => toast.dismiss(t.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-primary text-sm font-bold">
            New
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#111]">New booking request</p>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {data.status || 'Pending'}
              </span>
            </div>
            <p className="mt-1 truncate text-[13px] font-medium text-[#333]">
              {data.clientName}
              {data.phoneNumber ? (
                <span className="font-normal text-[#888]"> · {data.phoneNumber}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] text-[#666]">
              {data.date} at {data.time}
            </p>
            <p className="mt-1 truncate text-[12px] text-[#555]">{bookingSummary(data)}</p>
            {total && (
              <p className="mt-2 text-[13px] font-semibold tabular-nums text-brand-primary">
                Total {total}
              </p>
            )}
          </div>
        </div>
      </div>
    ),
    { duration: 7000 },
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NewAppointmentPayload[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const access = useContext(AdminAccessContext)
  const canViewBookings = canAccessPath(access?.user ?? null, '/admin/bookings')
  const canViewInvoices = canAccessPath(access?.user ?? null, '/admin/invoices')

  useEffect(() => {
    setIsMounted(true)
    if (!canViewBookings) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    const savedNotifs = localStorage.getItem('admin_notifications')
    const savedCount = localStorage.getItem('admin_unread_count')
    let loadedNotifs: NewAppointmentPayload[] = []

    if (savedNotifs) {
      try {
        loadedNotifs = JSON.parse(savedNotifs).map(normalizePayload)
        setNotifications(loadedNotifs)
      } catch (e) {
        console.error('Failed to parse notifications from localStorage:', e)
      }
    }
    if (savedCount) {
      setUnreadCount(parseInt(savedCount, 10) || 0)
    }

    const fetchLatestBookings = async () => {
      try {
        const data = await getAppointments({ page: 1, limit: 30, source: 'Online' })
        const appointmentsList = data?.data || data || []
        if (!Array.isArray(appointmentsList)) return

        setNotifications((prev) => {
          const currentList = prev.length > 0 ? prev : loadedNotifs
          const newestDate =
            currentList.length > 0 ? new Date(currentList[0].createdAt).getTime() : 0

          let newCount = 0
          const merged = [...currentList]

          appointmentsList.forEach((apt: any) => {
            const formatted = normalizePayload(apt)
            if (!merged.some((n) => n.id === formatted.id)) {
              merged.push(formatted)
              if (newestDate > 0 && new Date(formatted.createdAt).getTime() > newestDate) {
                newCount++
              }
            }
          })

          merged.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )

          if (newCount > 0) {
            setUnreadCount((c) => c + newCount)
          }

          return merged.slice(0, 50)
        })
      } catch (e) {
        console.error('Failed to fetch latest bookings for notifications:', e)
      }
    }

    fetchLatestBookings()
  }, [canViewBookings])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('admin_notifications', JSON.stringify(notifications))
    }
  }, [notifications, isMounted])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('admin_unread_count', unreadCount.toString())
    }
  }, [unreadCount, isMounted])

  useEffect(() => {
    if (!canViewBookings && !canViewInvoices) return
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) {
      console.warn('[Notification] No access token — skipping WS connect')
      return
    }

    const { url, options } = getSocketConnection()
    const socket = io(url, {
      ...options,
      auth: { branchId: document.cookie.split('; ').find(value => value.startsWith('branchId='))?.slice(9), token },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Notification] WS connected:', socket.id, 'via', options.path)
    })

    const SILENT_ERRORS = ['websocket error', 'xhr poll error', 'transport error', 'transport close']
    socket.on('connect_error', (err) => {
      if (!SILENT_ERRORS.some((s) => err.message.toLowerCase().includes(s))) {
        console.warn('[Notification] WS connection error:', err.message)
      }
    })

    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        console.warn('[Notification] WS disconnected:', reason)
      }
    })

    socket.on('new-appointment', (raw: any) => {
      if (!canViewBookings) return
      const data = normalizePayload(raw)
      console.log('[Notification] New appointment received:', data)
      // Persist NEW-badge unread state even when /admin/bookings is not mounted
      if (data.id) markBookingUnread(data.id)
      // Force next appointments list fetch to bypass axios cache (avoids stale rows/totals)
      markStale(CACHE.APPOINTMENTS)
      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev
        return [data, ...prev].slice(0, 50)
      })
      setUnreadCount((prev) => prev + 1)
      showBookingToast(data)
    })

    socket.on('new-invoice', (raw: any) => {
      if (!canViewInvoices) return
      const id = String(raw?.id || '').trim()
      if (!id) return
      markInvoiceUnread(id)
      markStale(CACHE.BILLING)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [canViewBookings, canViewInvoices])

  const markAllRead = useCallback(() => setUnreadCount(0), [])
  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAllRead, clearAll, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
