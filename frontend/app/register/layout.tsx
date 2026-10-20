import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Create an account",
    path: "/register",
    description: "Create a free account to book salon services online, save your favorite stylists, and keep every appointment in one place.",
    noindex: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
