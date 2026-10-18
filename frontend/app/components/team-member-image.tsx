"use client"

import { useState } from "react"
import { getMediaUrl } from "@/lib/utils"

interface TeamMemberImageProps {
  name: string
  image?: string | null
  /** Extra classes applied to the wrapping div */
  className?: string
  /** Tailwind text-size class for the initials, e.g. "text-5xl" */
  initialsSize?: string
  imgClassName?: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}



export function TeamMemberImage({
  name,
  image,
  className = "",
  initialsSize = "text-5xl",
  imgClassName = "w-full h-full object-cover",
}: TeamMemberImageProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const hasImage = image && typeof image === "string" && image.trim().length > 0

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-[#1a1a1a] ${className}`}>
      {hasImage && !imgFailed ? (
        <img
          src={getMediaUrl(image)}
          alt={name}
          onError={() => setImgFailed(true)}
          className={imgClassName}
        />
      ) : (
        <span
          className={`${initialsSize} font-serif tracking-tighter text-white opacity-60 select-none`}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}
