import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BookingTriggerButton } from "@/app/components/booking-trigger-button"

export function HeroSection() {
  return (
    <section className="hero-alive relative z-10 overflow-hidden min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 -mt-16">
      <div className="relative z-10 mx-auto w-full max-w-5xl -translate-y-20 sm:-translate-y-28 lg:-translate-y-32 text-center text-white py-20 sm:py-24 lg:py-28">
        <h1
          className="mx-auto max-w-6xl text-[2rem] font-semibold leading-[1.1] sm:text-[3.2rem] lg:text-[5.5rem]"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          <span className="block">
            <span className="hero-line-1 inline-block">The Art Of Beauty,</span>
          </span>
          <span className="block font-normal italic text-[#d4af37]">
            <span className="hero-line-2 inline-block">Redefined</span>
          </span>
        </h1>

        <p
          className="hero-sub mx-auto mt-6"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: "24px",
            color: "rgba(255, 255, 255, 0.85)",
          }}
        >
          Luxury experiences crafted for modern elegance.
        </p>

        <div className="hero-btns mt-12 flex flex-row items-center justify-center gap-3 sm:gap-4">
          <BookingTriggerButton className="hero-btn inline-flex items-center justify-center bg-white px-6 py-2.5 text-[10px] sm:px-10 sm:py-3.5 sm:text-[11px] font-bold uppercase tracking-widest text-black hover:bg-gray-200">
            <span className="sm:hidden">REQUEST</span>
            <span className="hidden sm:inline">REQUEST A BOOKING</span>
          </BookingTriggerButton>
          <Link
            href="/services"
            className="hero-btn inline-flex items-center justify-center gap-1.5 border-t-[3px] border-l-[3px] border-b border-r border-solid border-white bg-transparent px-6 py-2.5 text-[10px] sm:px-8 sm:py-3.5 sm:text-[11px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <span className="sm:hidden">EXPLORE</span>
            <span className="hidden sm:inline">EXPLORE OUR SERVICES</span>
            <ArrowRight size={12} strokeWidth={2} className="sm:hidden" />
            <ArrowRight size={15} strokeWidth={2} className="hidden sm:inline" />
          </Link>
        </div>
      </div>
    </section>
  )
}
