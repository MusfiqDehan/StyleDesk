import dynamic from "next/dynamic"
import { TheExperienceSection } from "./the-experience"
import { SisterConcernsSection } from "./sister-concerns-section"
import { HomeSectionSkeleton } from "./home-section-skeleton"
import { getActiveServices } from "@/app/api/services/services"
import { getPublicPackages } from "@/app/api/packages/packages"
import { getAppreciateExcellence } from "@/app/api/appreciate-excellence/appreciate-excellence"
import { getSisterConcerns } from "@/app/api/sister-concerns/sister-concerns"
import { getWhyChooseUsImages } from "@/app/api/why-choose-us/why-choose-us"
import { getPublicTestimonials } from "@/app/api/testimonials/public-testimonials"

const SignatureExperiencesSection = dynamic(
  () =>
    import("./signature-experiences").then((m) => ({
      default: m.SignatureExperiencesSection,
    })),
  { loading: () => <HomeSectionSkeleton className="bg-[#0b0b0b]" /> },
)

const WhyChooseUsSection = dynamic(
  () =>
    import("./why-choose-us").then((m) => ({ default: m.WhyChooseUsSection })),
  { loading: () => <HomeSectionSkeleton className="bg-[#f7f1eb]" /> },
)

const TestimonialsSection = dynamic(
  () =>
    import("./testimonials").then((m) => ({ default: m.TestimonialsSection })),
  { loading: () => <HomeSectionSkeleton className="bg-[#1a1a1a]" /> },
)

const Footer = dynamic(
  () => import("./footer").then((m) => ({ default: m.Footer })),
  { loading: () => <HomeSectionSkeleton className="bg-[#0b0b0b]" /> },
)

/** Streams after hero — each fetch is independent so one slow API doesn't block others via Suspense parents. */
export async function HomeServicesBlock() {
  const [servicesResult, packagesResult] = await Promise.all([
    getActiveServices().catch(() => []),
    getPublicPackages().catch(() => []),
  ])
  const services = Array.isArray(servicesResult) ? servicesResult : []
  const packages = Array.isArray(packagesResult) ? packagesResult : []
  return <SignatureExperiencesSection services={services} packages={packages} />
}

export async function HomeWhyChooseUsBlock() {
  const images = await getWhyChooseUsImages()
  return <WhyChooseUsSection images={images} />
}

export async function HomeExperienceBlock() {
  const excellence = await getAppreciateExcellence().catch(() => null)
  return <TheExperienceSection excellence={excellence} />
}

export async function HomeTestimonialsBlock() {
  const testimonials = await getPublicTestimonials()
  return <TestimonialsSection testimonials={testimonials} />
}

export async function HomeSisterConcernsBlock() {
  const sisterConcerns = await getSisterConcerns().catch(() => null)
  return <SisterConcernsSection data={sisterConcerns} />
}

export async function HomeFooterBlock() {
  return <Footer />
}
