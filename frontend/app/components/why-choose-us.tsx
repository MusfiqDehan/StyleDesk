"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { getMediaUrl } from "@/lib/utils"
import type { WhyChooseUsImages } from "@/app/api/why-choose-us/why-choose-us"

const stats = [
  { value: "8+", label: "Years of Excellence" },
  { value: "15K+", label: "Happy Clients" },
  { value: "20+", label: "Expert Artists" },
  { value: "45+", label: "Signature Services" },
]

function parseStat(value: string): { num: number; suffix: string } {
  const match = value.match(/^(\d+)(.*)$/)
  if (!match) return { num: 0, suffix: value }
  return { num: parseInt(match[1]), suffix: match[2] }
}

export function WhyChooseUsSection({
  images = [null, null, null, null],
}: {
  images?: WhyChooseUsImages
}) {
  const [counts, setCounts] = useState(stats.map(() => 0))
  const [started, setStarted] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true)
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const targets = stats.map((s) => parseStat(s.value).num)
    const duration = 2000
    const startTime = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCounts(targets.map((t) => Math.floor(eased * t)))
      if (progress < 1) requestAnimationFrame(animate)
      else setCounts(targets)
    }
    requestAnimationFrame(animate)
  }, [started])

  const placeholderTones = [
    "from-stone-200 via-stone-300 to-stone-400",
    "from-zinc-200 via-zinc-300 to-zinc-400",
    "from-neutral-200 via-stone-300 to-neutral-400",
    "from-stone-200 via-neutral-300 to-zinc-400",
  ]

  return (
    <section className="bg-transparent flex flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center mb-20">
          <p
            className="mb-4 text-[11px] font-bold uppercase tracking-widest text-[#d4af37]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            WHY CHOOSE US
          </p>
          <h2
            className="mb-6 text-[1.75rem] leading-tight text-black sm:text-[2.75rem] lg:text-[3.25rem]"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            Where Luxury Meets <span className="italic">Artistry</span>
          </h2>
          <p
            className="mx-auto max-w-3xl text-[13px] leading-relaxed text-gray-600"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Every visit is a journey through refined luxury. From our curated
            environments to our bespoke treatments, we create moments that
            transcend the ordinary.
          </p>
        </div>

        <div className="grid items-center gap-10 sm:gap-14 lg:gap-16 lg:grid-cols-2">
          <div ref={statsRef} className="grid grid-cols-2 gap-x-12 gap-y-14 pr-4 lg:pr-8">
            {stats.map((stat, i) => {
              const { suffix } = parseStat(stat.value)
              return (
                <div key={stat.label} className="flex flex-col items-center lg:items-start">
                  <p
                    className="text-[1.75rem] sm:text-[2.25rem] lg:text-[2.75rem] font-semibold text-black leading-none"
                    style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                  >
                    {counts[i]}
                    {suffix}
                  </p>
                  <p
                    className="mt-4 pb-3 text-[11px] font-bold text-gray-500 border-b border-[#d4af37] w-[90%] text-center lg:text-left"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {stat.label}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {images.map((img, index) => {
              const src = img ? getMediaUrl(img) : null
              return (
                <div
                  key={index}
                  className={`aspect-[4/3] overflow-hidden relative ${
                    !src
                      ? `bg-gradient-to-br ${placeholderTones[index]}`
                      : "bg-stone-200"
                  }`}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={`Privé Experience ${index + 1}`}
                      fill
                      loading="lazy"
                      sizes="(max-width: 1024px) 50vw, 280px"
                      className="object-cover transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div
                        className="border border-black/10 bg-white/40 px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] text-black/60 backdrop-blur-sm"
                        style={{ fontFamily: "var(--font-inter), sans-serif" }}
                      >
                        Signature Experience
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
