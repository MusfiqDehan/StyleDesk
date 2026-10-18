"use client"

import { useBooking } from "@/context/BookingContext"
import { ChevronLeft } from "lucide-react"

export function StylistBookingButton({ stylistName }: { stylistName: string }) {
    const { openBooking } = useBooking()

    const firstName = stylistName?.split(' ')[0]

    return (
        <button
            onClick={() => openBooking(undefined, stylistName)}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#c4a484] text-black font-semibold rounded hover:bg-white transition-all duration-300 group cursor-pointer"
        >
            Book Appointment with {firstName}
            <ChevronLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
        </button>
    )
}
