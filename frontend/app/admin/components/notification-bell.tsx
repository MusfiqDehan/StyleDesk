'use client'

import { useState } from 'react'
import { Bell, X, Calendar, User, Clock, Phone, Package } from 'lucide-react'
import { useNotificationContext, type NewAppointmentPayload } from '@admin/context/notification-context'
import { format } from 'date-fns'
import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'

function itemLabel(notif: NewAppointmentPayload) {
  if (notif.packageName) return notif.packageName
  const services = (notif.services || []).filter(Boolean)
  if (services.length === 0) return 'Booking request'
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')} +${services.length - 2}`
}

export function NotificationBell({
  buttonClassName,
  iconClassName,
}: {
  buttonClassName?: string
  iconClassName?: string
} = {}) {
  const { notifications, unreadCount, markAllRead, clearAll, removeNotification } =
    useNotificationContext()
  const [showDropdown, setShowDropdown] = useState(false)

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown)
    if (!showDropdown) markAllRead()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-brand-line bg-card transition-colors hover:bg-brand-mist focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
          buttonClassName,
        )}
        aria-label="Notifications"
      >
        <Bell className={cn("size-4 text-[#555]", iconClassName)} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#e11d48] px-1 text-[11px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-brand-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-[#f2f2f2] bg-[#fafafa] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-[#222]">Notifications</h3>
                <p className="text-[11px] text-[#888]">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] font-medium text-brand-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDropdown(false)}
                  className="rounded-md p-1 text-[#999] hover:bg-[#f2f2f2] hover:text-[#555]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft">
                    <Bell className="size-5 text-brand-primary" />
                  </div>
                  <p className="text-sm font-medium text-[#333]">No notifications yet</p>
                  <p className="mt-1 text-[12px] text-[#888]">
                    Website booking requests will appear here
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const total = Number(notif.totalAmount ?? 0)
                  return (
                    <div
                      key={notif.id}
                      className="group relative border-b border-[#f2f2f2] last:border-0"
                    >
                      <Link
                        href="/admin/bookings"
                        onClick={() => setShowDropdown(false)}
                        className="block px-4 py-3.5 pr-10 transition-colors hover:bg-[#f0f7ff]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                            <Calendar className="size-4 text-brand-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-semibold text-[#222]">
                                New booking request
                              </p>
                              <span
                                className={cn(
                                  'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                                  notif.source?.toLowerCase() === 'online'
                                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                                    : 'border-[#e7e7e7] bg-[#f8fafc] text-[#666]',
                                )}
                              >
                                {notif.source || 'Online'}
                              </span>
                            </div>

                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5 text-[12px] text-[#444]">
                                <User className="size-3 shrink-0 text-[#999]" />
                                <span className="truncate font-medium">{notif.clientName}</span>
                              </div>
                              {notif.phoneNumber && (
                                <div className="flex items-center gap-1.5 text-[12px] text-[#666]">
                                  <Phone className="size-3 shrink-0 text-[#999]" />
                                  <span>{notif.phoneNumber}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-[12px] text-[#666]">
                                <Clock className="size-3 shrink-0 text-[#999]" />
                                <span>
                                  {notif.date} at {notif.time}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[12px] text-[#666]">
                                <Package className="size-3 shrink-0 text-[#999]" />
                                <span className="truncate">{itemLabel(notif)}</span>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              {total > 0 ? (
                                <span className="text-[13px] font-semibold tabular-nums text-brand-primary">
                                  {formatCurrency(total)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#999]">Total pending</span>
                              )}
                              <span className="text-[10px] text-[#aaa]">
                                {format(new Date(notif.createdAt), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          removeNotification(notif.id)
                        }}
                        className="absolute right-3 top-3 rounded-md p-1 text-[#bbb] opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 focus:opacity-100"
                        title="Dismiss"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <Link
              href="/admin/bookings"
              onClick={() => setShowDropdown(false)}
              className="block border-t border-[#f2f2f2] bg-[#fafafa] px-4 py-3 text-center text-[12px] font-semibold text-brand-primary hover:bg-[#f0f7ff]"
            >
              Open bookings
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
