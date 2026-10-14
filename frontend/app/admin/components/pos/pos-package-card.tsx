"use client"

import { User } from "lucide-react"
import { cn, getMediaUrl } from "@/lib/utils"

function formatTk(value: number) {
  return `Tk.${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0)}`
}

export interface PosPackageCardData {
  id: string
  title: string
  category: string
  price: number
  imageUrl?: string | null
  count?: number
}

interface PosPackageCardProps {
  packageItem: PosPackageCardData
  selected?: boolean
  onSelect?: (packageItem: PosPackageCardData) => void
  className?: string
}

export function PosPackageCard({
  packageItem,
  selected = false,
  onSelect,
  className,
}: PosPackageCardProps) {
  const imageSrc = getMediaUrl(packageItem.imageUrl)
  const count = packageItem.count ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect?.(packageItem)}
      className={cn(
        "flex w-full flex-col items-start overflow-hidden rounded-xl border border-brand-line bg-white text-left transition-shadow",
        selected
          ? "ring-2 ring-brand-primary shadow-[0px_8px_24px_rgba(112,64,193,0.16)]"
          : "hover:shadow-[0px_8px_24px_rgba(40,35,51,0.06)]",
        className
      )}
    >
      <div className="relative h-[88px] w-full shrink-0 overflow-hidden rounded-t-xl bg-brand-mist sm:h-[108px]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={packageItem.title}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-brand-muted sm:text-xs">
            No image
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-1.5 rounded-b-xl bg-brand-mist px-2 pb-2.5 pt-1.5 sm:gap-2 sm:px-2.5 sm:pb-3 sm:pt-2">
        <div className="flex w-full min-w-0 flex-col gap-0.5 sm:gap-1">
          <p className="truncate text-[10px] font-medium uppercase leading-normal text-brand-primary sm:text-xs">
            {packageItem.category || "Package"}
          </p>
          <p className="truncate text-sm font-medium leading-5 text-black sm:text-[15px] sm:leading-[22px]">
            {packageItem.title}
          </p>
        </div>

        <div className="flex w-full items-center justify-between gap-1.5 sm:gap-2">
          <p className="shrink-0 whitespace-nowrap text-xs font-medium leading-4 text-brand-muted sm:text-sm">
            {formatTk(packageItem.price)}
          </p>

          <div className="flex w-[56px] shrink-0 items-center gap-0.5 rounded-lg border border-brand-line bg-white py-1 pl-0.5 pr-1 sm:w-[72px] sm:py-1.5 sm:pl-1 sm:pr-1.5">
            <img
              src="/icons/pos-user.svg"
              alt=""
              className="size-4 shrink-0 object-contain sm:size-5"
              onError={(e) => {
                e.currentTarget.style.display = "none"
                e.currentTarget.nextElementSibling?.classList.remove("hidden")
              }}
            />
            <User className="hidden size-4 shrink-0 text-brand-muted sm:size-5" />
            <span className="flex flex-1 items-center justify-center rounded-md bg-white px-1 py-0.5 text-xs font-medium leading-[18px] text-brand-muted sm:px-2 sm:text-sm">
              {count}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
