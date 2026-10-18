"use client"

import { useEffect, useRef, useState } from "react"

interface LazyVideoProps {
  src: string
  poster?: string
  className?: string
}

/** Loads and plays only when scrolled into view — avoids below-fold bandwidth. */
export function LazyVideo({ src, poster, className }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [activeSrc, setActiveSrc] = useState<string | undefined>(undefined)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          el.pause()
          return
        }
        setActiveSrc((prev) => prev ?? src)
        void el.play().catch(() => {})
      },
      { rootMargin: "200px 0px", threshold: 0.15 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [src])

  return (
    <video
      ref={ref}
      src={activeSrc}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      preload="none"
    />
  )
}
