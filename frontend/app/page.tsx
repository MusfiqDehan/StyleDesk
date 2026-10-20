import { headers } from "next/headers";
import { isPlatformHostname } from "@/lib/platform-host";
import { PlatformLanding } from "@/components/platform/landing";
import { SalonLanding } from "./components/salon-landing";
import { resolveBusinessName, resolveLogoUrl } from "@/lib/business-branding";
import { fetchBusinessInfoForMetadata } from "@/lib/business-branding-server";
import { PLATFORM_BRAND, TENANT_BRAND } from "@/lib/site";
import { tenantOrigin } from "@/lib/tenant-fetch";

async function platformStructuredData(origin: string) {
  const url = origin;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: "StyleDesk",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Cloud, Web-based",
        url,
        description: PLATFORM_BRAND.description,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          offerCount: "3",
        },
        screenshot: `${url}/brand/platform/og-cover.jpg`,
        creator: {
          "@type": "Person",
          name: PLATFORM_BRAND.author.name,
          url: PLATFORM_BRAND.author.url,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: "StyleDesk",
        url,
        inLanguage: "en",
        publisher: {
          "@type": "Organization",
          name: "StyleDesk",
          url,
          logo: `${url}/brand/platform/styledesk-modern.png`,
        },
      },
    ],
  };
}

async function salonStructuredData(origin: string) {
  const absoluteUrl = (path: string) => origin + path;
  const info = await fetchBusinessInfoForMetadata();
  const name = resolveBusinessName(info?.businessName);
  const url = absoluteUrl("/");
  const salon = {
    "@type": "BeautySalon",
    "@id": `${url}#salon`,
    name,
    url,
    description: TENANT_BRAND.description,
    logo: info?.logoUrl
      ? resolveLogoUrl(info.logoUrl)
      : absoluteUrl(TENANT_BRAND.icon512),
    image: absoluteUrl(TENANT_BRAND.cover),
    ...(info?.phone ? { telephone: info.phone } : {}),
    ...(info?.email ? { email: info.email } : {}),
    ...(info?.address ? { address: info.address } : {}),
    makesOffer: ["Hair & styling", "Beauty & glow", "Barber & grooming"].map(
      (service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service },
      }),
    ),
    potentialAction: {
      "@type": "ReserveAction",
      target: absoluteUrl("/services"),
      result: { "@type": "Reservation", name: "Salon appointment" },
    },
  };
  const website = {
    "@type": "WebSite",
    "@id": `${url}#website`,
    name,
    url,
    inLanguage: "en",
    publisher: { "@id": `${url}#salon` },
    creator: {
      "@type": "Person",
      name: PLATFORM_BRAND.author.name,
      url: PLATFORM_BRAND.author.url,
    },
  };
  return { "@context": "https://schema.org", "@graph": [salon, website] };
}

export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const isPlatform = isPlatformHostname(host);
  const origin = await tenantOrigin();

  if (isPlatform) {
    const jsonLd = await platformStructuredData(origin);
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <PlatformLanding />
      </>
    );
  }

  const jsonLd = await salonStructuredData(origin);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SalonLanding />
    </>
  );
}
