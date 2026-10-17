"use client"

import { useBooking } from "@/context/BookingContext"
import React from "react"

interface BookingTriggerButtonProps {
  className?: string
  children: React.ReactNode
}

export function BookingTriggerButton({ className, children }: BookingTriggerButtonProps) {
  const { openBooking } = useBooking()

  return (
    <button
      type="button"
      onClick={() => openBooking()}
      className={className}
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {children}
    </button>
  )
}
