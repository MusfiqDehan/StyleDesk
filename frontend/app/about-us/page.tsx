import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import api from "@admin/api/base";
import { resolveBusinessName } from "@/lib/business-branding";
import type { TeamMember } from "@/lib/team-presentation";
import { AboutExperience } from "./about-experience";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "About us",
    path: "/about-us",
    description:
      "Hair, beauty, and grooming under one roof. Learn our story, what we care about, and meet the people behind your next salon visit.",
  });
}

function rolePriority(member: TeamMember): number {
  const role = (
    member.role === "Other" ? member.customRole || "" : member.role || ""
  )
    .toLowerCase()
    .trim();
  if (role.includes("ceo") && role.includes("founder")) return 1;
  if (role === "ceo") return 2;
  if (role.includes("founder")) return 3;
  return 100;
}

async function fetchTeam(): Promise<TeamMember[]> {
  const { data } = await api.get("/employee/basic", { cache: false as any });
  const list: TeamMember[] = Array.isArray(data)
    ? data
    : data?.data || data?.items || [];
  return [...list].sort((a, b) => rolePriority(a) - rolePriority(b)).slice(0, 3);
}

async function fetchBusinessName() {
  try {
    const { data } = await api.get("/bussiness-info", { cache: false as any });
    return resolveBusinessName(data?.businessName);
  } catch {
    return resolveBusinessName();
  }
}

export default async function AboutUsPage() {
  const [brandName, people] = await Promise.all([
    fetchBusinessName(),
    fetchTeam().catch(() => [] as TeamMember[]),
  ]);

  return <AboutExperience brandName={brandName} people={people} />;
}
