import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Sign in",
    path: "/login",
    description: "Sign in to book and manage salon appointments, or open your salon workspace for bookings, POS, staff, and reports.",
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
