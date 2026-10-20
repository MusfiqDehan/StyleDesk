import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PackagesExperience } from "./packages-experience";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Salon packages",
    path: "/packages",
    description:
      "Bundle your favorite hair, beauty, and grooming rituals into one feel-good visit. Browse salon packages and bridal bundles, and book online.",
  });
}

export default function PackagesPage() {
  return <PackagesExperience />;
}
