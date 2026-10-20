import type { Metadata } from "next";
import { catalogItemMetadata } from "@/lib/catalog-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return catalogItemMetadata({
    endpoint: "makeover-packages",
    route: "packages",
    id,
    fallbackTitle: "Salon package",
    fallbackDescription: "See every service included in this salon package and book your visit online.",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
