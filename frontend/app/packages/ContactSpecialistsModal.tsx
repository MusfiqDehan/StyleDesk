"use client"

import { useState } from "react"
import { useBusiness } from "@/context/BusinessContext"
import { X, Phone, Mail, MapPin } from "lucide-react"

interface ContactSpecialistsModalProps {
  triggerLabel?: string
  triggerClassName?: string
}

export default function ContactSpecialistsModal({
  triggerLabel = "Contact our specialists",
  triggerClassName = "inline-flex items-center gap-2 text-[#c4a484] text-xs font-bold tracking-widest uppercase hover:text-white transition-colors",
}: ContactSpecialistsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { businessInfo } = useBusiness()

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel} <ArrowRight className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#111] border border-white/10 shadow-2xl rounded-2xl overflow-hidden p-6">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#c4a484] mb-1">
                  Get in Touch
                </p>
                <h2 className="text-2xl font-serif text-white">Contact Specialists</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#c4a484]/10 border border-[#c4a484]/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-[#c4a484]" />
                </div>
                <div className="flex flex-col justify-center min-h-[3rem]">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-1">Phone</p>
                  <p className="text-[15px] font-medium text-white/90">{businessInfo?.phone || "+880 123456789"}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#c4a484]/10 border border-[#c4a484]/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[#c4a484]" />
                </div>
                <div className="flex flex-col justify-center min-h-[3rem]">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-1">Email</p>
                  <p className="text-[15px] font-medium text-white/90">{businessInfo?.email || "contact@example.com"}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#c4a484]/10 border border-[#c4a484]/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#c4a484]" />
                </div>
                <div className="flex flex-col justify-center min-h-[3rem]">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 mb-1">Address</p>
                  <p className="text-[15px] font-medium text-white/90 leading-relaxed">{businessInfo?.address || "123 Salon Street, City"}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-8 py-3.5 bg-white text-black text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#c4a484] hover:text-white transition-all duration-300 rounded-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}
