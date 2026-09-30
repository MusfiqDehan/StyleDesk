"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Service } from '@/lib/types'

interface BookingContextType {
    isOpen: boolean
    selectedService: Service | null
    preSelectedStylist: string | null
    /** Prefill maps when opening from cart (or empty when picking freely). */
    initialServiceQty: Record<string, number> | null
    initialPackageQty: Record<string, number> | null
    openBooking: (service?: Service, stylist?: string) => void
    openBookingFromCart: (
        serviceQty: Record<string, number>,
        packageQty: Record<string, number>,
    ) => void
    closeBooking: () => void
}

const BookingContext = createContext<BookingContextType | undefined>(undefined)

export function BookingProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<Service | null>(null)
    const [preSelectedStylist, setPreSelectedStylist] = useState<string | null>(null)
    const [initialServiceQty, setInitialServiceQty] = useState<Record<string, number> | null>(null)
    const [initialPackageQty, setInitialPackageQty] = useState<Record<string, number> | null>(null)

    const requireAuth = () => {
        const token = localStorage.getItem('accessToken')
        if (!token) {
            window.location.href = '/login'
            return false
        }
        return true
    }

    const openBooking = (service?: Service, stylist?: string) => {
        if (!requireAuth()) return

        setInitialServiceQty(null)
        setInitialPackageQty(null)

        if (service) {
            setSelectedService(service)
        } else {
            setSelectedService(null)
        }

        if (stylist) {
            setPreSelectedStylist(stylist)
        } else {
            setPreSelectedStylist(null)
        }

        setIsOpen(true)
    }

    const openBookingFromCart = (
        serviceQty: Record<string, number>,
        packageQty: Record<string, number>,
    ) => {
        if (!requireAuth()) return

        setSelectedService(null)
        setPreSelectedStylist(null)
        setInitialServiceQty({ ...serviceQty })
        setInitialPackageQty({ ...packageQty })
        setIsOpen(true)
    }

    const closeBooking = () => {
        setIsOpen(false)
        setSelectedService(null)
        setPreSelectedStylist(null)
        setInitialServiceQty(null)
        setInitialPackageQty(null)
    }

    return (
        <BookingContext.Provider
            value={{
                isOpen,
                selectedService,
                preSelectedStylist,
                initialServiceQty,
                initialPackageQty,
                openBooking,
                openBookingFromCart,
                closeBooking,
            }}
        >
            {children}
        </BookingContext.Provider>
    )
}

export function useBooking() {
    const context = useContext(BookingContext)
    if (context === undefined) {
        throw new Error('useBooking must be used within a BookingProvider')
    }
    return context
}
