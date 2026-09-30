'use client'

import { useEffect, useRef, useCallback } from 'react'
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

interface SocketHandlers {
  onNewAppointment?: (payload: NewAppointmentPayload) => void
}

export function useNotificationSocket(handlers: SocketHandlers) {
  const socketRef = useRef<Socket | null>(null)
  const handlerRef = useRef<SocketHandlers>(handlers)

  useEffect(() => {
    handlerRef.current = handlers
  }, [handlers])

  useEffect(() => {
    // Root namespace (NotificationGateway has no custom namespace)
    const { url, options } = getSocketConnection()
    const socket = io(url, options)

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Notification] WS connected:', socket.id, 'via', options.path)
    })

    socket.on('connect_error', (err) => {
      console.error('[Notification] WS connection error:', err)
    })

    socket.on('reconnect', (attempt) => {
      console.log('[Notification] WS reconnected after', attempt, 'attempts')
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Notification] WS disconnected:', reason)
    })

    socket.on('new-appointment', (payload: NewAppointmentPayload) => {
      console.log('[Notification] New appointment received:', payload)
      handlerRef.current.onNewAppointment?.(payload)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  return { disconnect }
}
