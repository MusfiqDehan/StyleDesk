import { CtaSection } from "./cta-section"
import { getMediaUrl } from "@/lib/utils"
import { getBeginYourJourneyImage } from "@/app/api/begin-your-journey/begin-your-journey"
/** Server-only: loads CMS background then renders CtaSection. */
export async function CtaSectionAsync() {
  const remoteImage = await getBeginYourJourneyImage()
  const bgImage =
    (remoteImage ? getMediaUrl(remoteImage) : null) || "/BeginYourJourney.avif"
  return <CtaSection bgImage={bgImage} />
}
