'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { getSocketConnection } from '@admin/lib/socket'

export interface NewAppointmentPayload {
  id: string
  clientName: string
  phoneNumber: string
  date: string
  time: string
  services: string[]
  status: string
  createdAt: string
}

interface NotificationHandlers {
  onNewAppointment?: (payload: NewAppointmentPayload) => void
}

export function useNotification(handlers: NotificationHandlers) {
  const handlerRef = useRef<NotificationHandlers>(handlers)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    handlerRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const { url, options } = getSocketConnection()
    const socket = io(url, options)

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Notification] WS connected:', socket.id, 'via', options.path)
    })

    socket.on('connect_error', (err) => {
      console.error('[Notification] WS connection error:', err.message)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Notification] WS disconnected:', reason)
    })

    socket.on('new-appointment', (data: NewAppointmentPayload) => {
      console.log('[Notification] New appointment received:', data)
      handlerRef.current.onNewAppointment?.(data)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])
}
