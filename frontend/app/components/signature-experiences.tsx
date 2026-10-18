"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/context/CartContext"
import { Service } from "@/lib/types"
import { formatCurrency, getMediaUrl, cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

const CATEGORY_GRADIENTS: Record<string, string> = {
  Hair: "from-rose-200 via-pink-200 to-fuchsia-200",
  Makeup: "from-amber-200 via-stone-300 to-stone-500",
  Skin: "from-orange-100 via-rose-100 to-amber-200",
  Bridal: "from-amber-200 via-stone-300 to-stone-500",
  Nails: "from-pink-200 via-purple-200 to-indigo-200",
  Spa: "from-teal-200 via-cyan-100 to-sky-200",
  Other: "from-stone-300 via-stone-400 to-stone-500",
}

type CatalogTab = "services" | "packages"

export type SignaturePackage = {
  id: string
  category?: string
  title: string
  price: number | string
  description?: string
  features?: string[]
  imageUrl?: string
  image?: string
  coverImage?: string
  billingCycle?: string
}

const TAB_OPTIONS: { id: CatalogTab; label: string }[] = [
  { id: "services", label: "Services" },
  { id: "packages", label: "Packages" },
]

export function SignatureExperiencesSection({
  services,
  packages,
}: {
  services: Service[]
  packages: SignaturePackage[]
}) {
  const { addItem } = useCart()
  const [activeTab, setActiveTab] = useState<CatalogTab>("services")

  const visibleServices = services.slice(0, 6)
  const visiblePackages = packages.slice(0, 6)
  const isServicesTab = activeTab === "services"
  const hasItems = isServicesTab ? visibleServices.length > 0 : visiblePackages.length > 0

  return (
    <section id="services" className="bg-[#0b0b0b] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#d4af37]"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              OUR EXPERTISE
            </p>
            <h2
              className="text-[1.75rem] leading-none text-white sm:text-[2.5rem] lg:text-[3rem]"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              <span className="font-semibold">Signature</span>{" "}
              <span className="italic">Experiences</span>
            </h2>
          </div>

          <Link
            href={isServicesTab ? "/services" : "/packages"}
            className="inline-flex items-center gap-2 self-start border-t-3 border-l-3 border-b border-r border-solid border-white bg-transparent px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {isServicesTab ? "VIEW ALL SERVICES" : "VIEW ALL PACKAGES"}{" "}
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>

        <div className="mb-10 flex flex-wrap justify-start gap-3">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-7 py-2.5 text-[10px] uppercase tracking-[0.25em] transition-all duration-300 border-t-[3px] border-l-[3px] border-b border-r",
                activeTab === tab.id
                  ? "border-[#d4af37] text-[#d4af37]"
                  : "border-white bg-transparent text-white hover:border-white/80 hover:text-white/80",
              )}
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid justify-items-center gap-8 lg:grid-cols-3">
          {hasItems ? (
            isServicesTab ? (
              visibleServices.map((item, index) => {
                const gradient = CATEGORY_GRADIENTS[item.category] ?? CATEGORY_GRADIENTS.Other
                const imageUrl = item.imageUrl ?? null

                return (
                  <article
                    key={item.id}
                    className="group flex h-full w-full max-w-[380px] flex-col border border-transparent bg-[#171717] text-white transition-all duration-300 hover:border-[#d4af37]"
                  >
                    <div
                      className={`relative aspect-[4/3] shrink-0 overflow-hidden ${imageUrl ? "" : `bg-gradient-to-br ${gradient}`}`}
                    >
                      {imageUrl && (
                        <Image
                          src={getMediaUrl(imageUrl) || ""}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          loading={index === 0 ? "eager" : "lazy"}
                          priority={index === 0}
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:bg-black/0" />
                    </div>

                    <div className="flex flex-grow flex-col p-7">
                      <div>
                        <p
                          className="mb-3 truncate text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.category}
                        </p>
                        <h3
                          className="truncate text-[17px] font-bold text-white"
                          title={item.name}
                          style={{ fontFamily: "Playfair Display, serif" }}
                        >
                          {item.name}
                        </h3>
                        <p
                          className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-gray-400"
                          title={item.description}
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-auto">
                        <div className="my-6 border-t border-white/10" />
                        <p
                          className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          STARTING FROM{" "}
                          <span className="ml-1 text-white">{formatCurrency(item.price)}</span>
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              addItem({
                                type: "service",
                                id: item.id,
                                name: item.name,
                                price: Number(item.price) || 0,
                                imageUrl: item.imageUrl,
                              })
                            }
                            className="flex flex-1 items-center justify-center bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-gray-200"
                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                          >
                            ADD TO CART
                          </button>
                          <Link
                            href={`/services/${item.id}`}
                            className="flex flex-1 items-center justify-center border border-solid border-white border-b border-r border-l-[3px] border-t-[3px] bg-transparent px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white/10"
                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                          >
                            VIEW DETAILS
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              visiblePackages.map((item, index) => {
                const imageUrl = item.imageUrl || item.image || item.coverImage || null

                return (
                  <article
                    key={item.id}
                    className="group flex h-full w-full max-w-[380px] flex-col border border-transparent bg-[#171717] text-white transition-all duration-300 hover:border-[#d4af37]"
                  >
                    <div
                      className={`relative aspect-[4/3] shrink-0 overflow-hidden ${imageUrl ? "" : "bg-gradient-to-br from-stone-500 via-stone-600 to-stone-800"}`}
                    >
                      {imageUrl && (
                        <Image
                          src={getMediaUrl(imageUrl) || ""}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          loading={index === 0 ? "eager" : "lazy"}
                          priority={index === 0}
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:bg-black/0" />
                    </div>

                    <div className="flex flex-grow flex-col p-7">
                      <div>
                        <p
                          className="mb-3 truncate text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.category || "Package"}
                        </p>
                        <h3
                          className="truncate text-[17px] font-bold text-white"
                          title={item.title}
                          style={{ fontFamily: "Playfair Display, serif" }}
                        >
                          {item.title}
                        </h3>
                        <p
                          className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-gray-400"
                          title={item.description}
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          {item.description ||
                            (item.features?.length
                              ? `${item.features.slice(0, 2).join(" · ")}${item.features.length > 2 ? "…" : ""}`
                              : "")}
                        </p>
                      </div>

                      <div className="mt-auto">
                        <div className="my-6 border-t border-white/10" />
                        <p
                          className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#d4af37]"
                          style={{ fontFamily: "var(--font-inter), sans-serif" }}
                        >
                          STARTING FROM{" "}
                          <span className="ml-1 text-white">{formatCurrency(item.price)}</span>
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              addItem({
                                type: "package",
                                id: item.id,
                                name: item.title,
                                price: Number(item.price) || 0,
                                imageUrl,
                              })
                            }
                            className="flex flex-1 items-center justify-center bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-gray-200"
                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                          >
                            ADD TO CART
                          </button>
                          <Link
                            href={`/packages/${item.id}`}
                            className="flex flex-1 items-center justify-center border border-solid border-white border-b border-r border-l-[3px] border-t-[3px] bg-transparent px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white/10"
                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                          >
                            VIEW DETAILS
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            )
          ) : (
            <div className="col-span-full py-20 text-center text-white/30">
              <p className="text-sm uppercase tracking-widest">
                {isServicesTab
                  ? "No services available at the moment."
                  : "No packages available at the moment."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
