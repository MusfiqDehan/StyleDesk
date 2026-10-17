import Link from "next/link"
import { getMediaUrl } from "@/lib/utils"

/** Sync UI — safe to render from both Server and Client Components. */
export function CtaSection({
  bgImage = "/BeginYourJourney.avif",
}: {
  bgImage?: string
}) {
  return (
    <section
      className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${bgImage}')` }}
    >
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <p
          className="mb-4 text-[11px] font-bold uppercase tracking-widest text-[#d4af37]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          BEGIN YOUR JOURNEY
        </p>

        <h2
          className="mb-6 text-[1.75rem] font-medium leading-[1.2] text-white sm:text-[2.75rem] lg:text-[3.5rem]"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          Ready To Experience
          <br />
          True <span className="italic">Luxury?</span>
        </h2>

        <p
          className="mb-10 max-w-2xl text-[13px] leading-relaxed text-gray-200"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          Join the exclusive community of those who understand that beauty is not
          just about appearance it&apos;s about the experience.
        </p>

        <div className="flex justify-center">
          <Link href="/services" scroll>
            <button
              type="button"
              className="inline-flex items-center gap-2 border-t-[3px] border-l-[3px] border-b border-r border-solid border-white bg-transparent px-8 py-2 sm:py-3.5 text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              <span className="sm:hidden">EXPLORE</span>
              <span className="hidden sm:inline">EXPLORE OUR SERVICES</span>
              <span className="text-lg leading-none mb-[2px]">→</span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}
