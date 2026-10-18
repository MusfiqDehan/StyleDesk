import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "My appointments",
    path: "/customer-dashboard",
    description: "Your upcoming and past salon appointments.",
    surface: "tenant",
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
