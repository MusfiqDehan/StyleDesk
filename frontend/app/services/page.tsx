import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ServicesExperience } from "./services-experience";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Services",
    path: "/services",
    description:
      "Explore hair, beauty, and barbering services — cuts, color, blowouts, facials, makeup, and grooming. Compare prices and durations, then book your stylist online.",
  });
}

export default function ServicesPage() {
  return <ServicesExperience />;
}
