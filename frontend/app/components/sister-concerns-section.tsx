import Image from "next/image"
import Link from "next/link"
import {
  type SisterConcernsData,
  resolveSisterConcernsContent,
} from "@/lib/sister-concerns"
import { getMediaUrl } from "@/lib/utils"

function renderEmphasisText(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="font-normal italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={index}>{part}</span>
  })
}

function resolveImageSrc(imageUrl: string) {
  if (imageUrl.startsWith("/")) return imageUrl
  return getMediaUrl(imageUrl) || imageUrl
}

export function SisterConcernsSection({ data }: { data: SisterConcernsData | null }) {
  const content = resolveSisterConcernsContent(data)
  const imageSrc = resolveImageSrc(content.imageUrl)
  const isExternal = /^https?:\/\//i.test(content.buttonLink)

  return (
    <section className="bg-[#1a1a1a] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-20">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-8 xl:gap-12">
        <div className="flex flex-col gap-8 sm:gap-10">
          <div className="flex flex-col gap-4">
            <p
              className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#eccd80] sm:text-[15px]"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {content.aboveText}
            </p>
            <h2
              className="text-[2rem] capitalize leading-tight text-white sm:text-[2.5rem] lg:text-[3rem] xl:text-[48px]"
              style={{ fontFamily: "Playfair Display, serif", fontWeight: 600 }}
            >
              {renderEmphasisText(content.mainText)}
            </h2>
            <p
              className="max-w-xl text-[15px] leading-[1.5] text-white sm:text-[16px]"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {content.subText}
            </p>
          </div>

          <Link
            href={content.buttonLink}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="inline-flex w-fit items-center gap-2 border border-white border-t-[3px] border-l-[3px] bg-transparent px-8 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-all duration-300 hover:bg-white hover:text-black sm:text-[14px]"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {content.buttonText}
            <span className="text-lg leading-none mb-[1px]">→</span>
          </Link>
        </div>

        <div className="relative mx-auto w-full max-w-[570px] border border-white border-t-2 border-l-2 lg:mx-0 lg:max-w-none">
          <div className="relative aspect-[570/405] w-full overflow-hidden bg-white">
            <Image
              src={imageSrc}
              alt={content.mainText.replace(/\*/g, "")}
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 570px"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
