import type { Metadata } from "next";
import { catalogItemMetadata } from "@/lib/catalog-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return catalogItemMetadata({
    endpoint: "service",
    route: "services",
    id,
    fallbackTitle: "Salon service",
    fallbackDescription: "See what is included, how long it takes, and the price — then book your salon appointment online.",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
