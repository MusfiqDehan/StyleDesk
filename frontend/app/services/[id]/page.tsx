"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { SiteHeader } from "../../components/site-header"
import { Footer } from "../../components/footer"
import { TestimonialsSection } from "../../components/testimonials"
import { Service } from "@/lib/types"
import { Clock, CheckCircle2 } from "lucide-react"
import { useCart } from "@/context/CartContext"
import { useBusiness } from "@/context/BusinessContext"
import { formatCurrency, getMediaUrl } from "@/lib/utils"

export default function ServiceDetailPage() {
    const { businessInfo } = useBusiness()
    const { addItem } = useCart()
    const { id } = useParams()
    const [service, setService] = useState<Service | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchService = async () => {
            try {
                // Assuming there's an endpoint to get service by id
                const response = await fetch(`${"/api/backend"}/service/${id}`)
                const data = await response.json()
                setService(data)
            } catch (error) {
                console.error("Error fetching service details:", error)
            } finally {
                setLoading(false)
            }
        }

        if (id) fetchService()
    }, [id])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span className="text-[11px] uppercase tracking-[0.3em]">Refining Details...</span>
                </div>
            </div>
        )
    }

    if (!service) {
        return (
            <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
                <p>Service not found.</p>
            </div>
        )
    }

    // Mock features based on category or default
    const features = [
        "Premium Products Only",
        "Expert Consultation",
        "Personalized Approach",
        "Professional Styling",
        "Long-lasting Results",
        "Aftercare Support"
    ]

    return (
        <div className="min-h-screen bg-[#111] text-white">
            <SiteHeader solid />

            {/* Hero Section with Image Background */}
            <section className="relative h-[60vh] w-full overflow-hidden">
                {service.imageUrl ? (
                    <img
                        src={getMediaUrl(service.imageUrl)}
                        alt={service.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-stone-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/40 to-transparent" />
            </section>

            {/* Content Overlay Card */}
            <main className="relative z-10 -mt-32 px-4 pb-20 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    <div className="bg-[#111] border-none p-10 md:p-14 shadow-2xl">
                        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr]">

                            {/* Left Content */}
                            <div>
                                <p className="mb-4 text-[9px] uppercase tracking-[0.3em] text-[#CDB37F]" style={{ fontFamily: 'Inter, sans-serif' }}>
                                    {service.category} SERVICES
                                </p>
                                <h1 className="mb-6 text-3xl font-semibold leading-tight sm:text-[2.5rem] text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                    {service.name}
                                </h1>

                                {/* Stats/Info */}
                                <div className="mb-8 flex flex-wrap gap-6 text-[9px] uppercase tracking-[0.2em] text-white/50">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3" strokeWidth={1.5} />
                                        <span>{service.duration} mins</span>
                                    </div>
                                </div>

                                <p className="mb-10 text-[11px] leading-7 text-white/60 max-w-xl" style={{ fontFamily: 'Inter, sans-serif' }}>
                                    {service.description || "Indulge in our signature treatment designed to revitalize your senses and enhance your natural beauty. Our expert artisans use only the finest techniques and products to ensure an unparalleled experience."}
                                </p>

                                {/* Features Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-2">
                                    {features.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-3 text-[10px] uppercase tracking-[0.15em] text-white/70 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white/50" strokeWidth={1.5} />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Side: Booking/Price */}
                            <div className="flex flex-col justify-center border-t border-white/5 pt-10 md:border-t-0 md:border-l md:border-white/5 md:pl-12 md:pt-0">
                                <div className="text-center md:text-left">
                                    <p className="mb-2 text-[8px] uppercase tracking-[0.25em] text-[#CDB37F]" style={{ fontFamily: 'Inter, sans-serif' }}>
                                        STARTING FROM
                                    </p>
                                    <div className="mb-8 text-3xl font-normal text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                        {formatCurrency(service.price).replace('Tk', '৳')}
                                    </div>
                                    <button
                                        onClick={() =>
                                            service &&
                                            addItem({
                                                type: "service",
                                                id: service.id,
                                                name: service.name,
                                                price: Number(service.price) || 0,
                                                imageUrl: service.imageUrl,
                                            })
                                        }
                                        className="w-full bg-white text-black py-3.5 text-[9px] uppercase tracking-[0.25em] font-semibold transition-all duration-300 hover:bg-white/90"
                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                    >
                                        ADD TO CART
                                    </button>
                                    <p className="mt-5 text-[8px] text-white/30 tracking-[0.2em] uppercase text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
                                        FREE CONSULTATION - FLEXIBLE SCHEDULING
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>

            {/* Testimonials */}
            <TestimonialsSection />

            <Footer />
        </div>
    )
}
