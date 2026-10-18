import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContactExperience } from "./contact-experience";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Contact us",
    path: "/contact",
    description:
      "Questions, dates, or a little advice before you book? Find our address, phone, and opening details — or put yourself on the calendar online.",
  });
}

export default function ContactPage() {
  return <ContactExperience />;
}
