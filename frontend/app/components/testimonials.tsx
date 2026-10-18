"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { getMediaUrl } from "@/lib/utils"
import type { PublicTestimonial } from "@/app/api/testimonials/public-testimonials"

const FALLBACK_ITEMS: PublicTestimonial[] = [
  {
    description:
      "Excellent service with high-quality products. The team understands client needs very well and delivers beyond expectations.",
    name: "Farhana Ahmed",
    position: "Entrepreneur",
  },
  {
    description:
      "Professional service and very friendly staff. The look was subtle yet elegant - exactly what I wanted for my office event.",
    name: "Ayesha Karim",
    position: "Corporate Professional",
  },
  {
    description:
      "The atmosphere is premium, and the artists are extremely attentive. I left feeling confident and refreshed.",
    name: "Nusrat Jahan",
    position: "Marketing Lead",
  },
  {
    description:
      "Absolutely loved the bridal package. Every detail was taken care of with such grace. Highly recommend to everyone.",
    name: "Taslima Hossain",
    position: "Bride",
  },
]

export function TestimonialsSection({
  testimonials = [],
}: {
  testimonials?: PublicTestimonial[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const items = testimonials.length > 0 ? testimonials : FALLBACK_ITEMS

  const slides: (typeof items)[] = []
  if (isMobile) {
    items.forEach((item) => slides.push([item]))
  } else {
    for (let i = 0; i < items.length; i += 2) {
      slides.push(items.slice(i, i + 2))
    }
  }

  useEffect(() => {
    setActiveIndex(0)
  }, [isMobile])

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, 4200)

    return () => window.clearInterval(intervalId)
  }, [slides.length, isPaused])

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, slides.length])

  return (
    <section className="testimonial-alive bg-[#1a1a1a] px-4 py-12 sm:px-6 sm:py-16 lg:px-[135px] lg:py-16">
      <div className="mx-auto flex w-full max-w-[1150px] flex-col items-center text-center">
        <div className="testimonial-intro max-w-[770px]">
          <p
            className="mb-4 text-[15px] font-medium uppercase tracking-[0.45em] text-[#eccd80]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            TESTIMONIAL
          </p>
          <h2
            className="text-[1.75rem] leading-none text-white sm:text-[2.5rem] lg:text-[48px]"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            Our Happy Client <span className="italic">Review</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-[720px] text-[14px] leading-[1.5] text-white"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Trusted by clients who value modern style, professional care, and a
            relaxing beauty experience designed to make every visit feel special.
          </p>
        </div>

        <div
          className="mt-16 w-full overflow-hidden pt-8"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {slides.map((slide, slideIndex) => (
              <div
                key={slideIndex}
                className="flex w-full shrink-0 flex-col gap-6 lg:flex-row lg:gap-[30px]"
              >
                {slide.map((item, cardIndex) => (
                  <article
                    key={`${item.name}-${cardIndex}`}
                    className="testimonial-card relative flex min-h-[264px] flex-1 flex-col justify-between border border-[#eccd80] px-8 pb-10 pt-12 text-left sm:px-10 lg:px-16"
                  >
                    <div className="absolute left-0 top-0 h-px w-full bg-[#eccd80]" />
                    <div className="absolute -top-[10px] left-10 bg-[#1a1a1a] px-2 sm:left-12 sm:px-3 lg:left-14">
                      <span
                        className="testimonial-quote block text-[108px] font-semibold leading-[0.5] text-white"
                        style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                        aria-hidden="true"
                      >
                        “
                      </span>
                    </div>

                    <p
                      className="max-w-[370px] text-[18px] leading-[1.52] text-white"
                      style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                    >
                      {item.description}
                    </p>

                    <div className="mt-10 flex items-center gap-3">
                      {item.imageUrl ? (
                        <div className="relative h-[42px] w-[42px] flex-shrink-0 overflow-hidden rounded-full">
                          <Image
                            src={getMediaUrl(item.imageUrl) ?? ""}
                            alt={item.name || "Client"}
                            fill
                            className="object-cover"
                            sizes="42px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-[#eccd80] text-sm font-semibold text-black">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p
                          className="text-[18px] font-semibold leading-none text-white"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.name}
                        </p>
                        <p
                          className="mt-1 text-[12px] leading-none text-white/65"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.position}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="testimonial-dots mt-12 flex items-center gap-[6px]">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to review ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={
                index === activeIndex
                  ? "testimonial-dot-active h-[6px] w-[24px] rounded-full bg-[#eccd80]"
                  : "h-[6px] w-[6px] rounded-full bg-white/75 transition-colors duration-200 hover:bg-white"
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}
