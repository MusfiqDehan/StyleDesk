'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getSocketConnection } from '@admin/lib/socket'

export interface NewDeviceUserPayload {
  id: string
  device_uid: string
  name: string | null
}

export interface AttendanceUpdatedPayload {
  refreshedAt: string
  attendanceDates: string[]
  deviceUserIds: string[]
}

export interface UnlinkedFingerprintScannedPayload {
  deviceUserId: string
  name: string | null
  attendanceDate: string
}

export interface EnrollmentCompletedPayload {
  employeeId: string
  deviceUid: string
  name: string | null
}

export interface EnrollmentStatusPayload {
  employeeId: string
  deviceUid: string
  status: 'waiting' | 'completed' | 'failed'
  message?: string
}

interface SocketHandlers {
  onNewDeviceUser?: (payload: NewDeviceUserPayload) => void
  onAttendanceUpdated?: (payload: AttendanceUpdatedPayload) => void
  onUnlinkedFingerprintScanned?: (payload: UnlinkedFingerprintScannedPayload) => void
  onEnrollmentCompleted?: (payload: EnrollmentCompletedPayload) => void
  onEnrollmentStatus?: (payload: EnrollmentStatusPayload) => void
}

export function useBiometricSocket(handlers: SocketHandlers) {
  const socketRef = useRef<Socket | null>(null)
  const handlerRef = useRef<SocketHandlers>(handlers)

  useEffect(() => {
    handlerRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const { url, options } = getSocketConnection()
    const socket = io(url, options)

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Biometric] WS connected:', socket.id, 'via', options.path)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Biometric] WS disconnected:', reason)
    })

    socket.on('new-device-user', (payload: NewDeviceUserPayload) => {
      handlerRef.current.onNewDeviceUser?.(payload)
    })

    socket.on('attendance-updated', (payload: AttendanceUpdatedPayload) => {
      handlerRef.current.onAttendanceUpdated?.(payload)
    })

    socket.on('unlinked-fingerprint-scanned', (payload: UnlinkedFingerprintScannedPayload) => {
      handlerRef.current.onUnlinkedFingerprintScanned?.(payload)
    })

    socket.on('enrollment-completed', (payload: EnrollmentCompletedPayload) => {
      handlerRef.current.onEnrollmentCompleted?.(payload)
    })

    socket.on('enrollment-status', (payload: EnrollmentStatusPayload) => {
      handlerRef.current.onEnrollmentStatus?.(payload)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, []) // connect once on mount

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  return { disconnect }
}
