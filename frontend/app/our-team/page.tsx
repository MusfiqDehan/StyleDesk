import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import api from "@admin/api/base";
import { PeopleExperience } from "./people-experience";
import type { TeamMember } from "@/lib/team-presentation";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Our stylists & team",
    path: "/our-team",
    description:
      "Meet our stylists, barbers, and beauty artists. Explore their specialties and experience, then book with someone whose style feels like yours.",
  });
}

async function fetchTeam(): Promise<TeamMember[]> {
  const { data } = await api.get("/employee/basic", { cache: false as any });
  return Array.isArray(data) ? data : data?.data || data?.items || [];
}

export default async function OurTeamPage() {
  let employees: TeamMember[] = [];
  try {
    employees = await fetchTeam();
  } catch (error) {
    console.error("Failed to fetch team:", error);
  }

  return <PeopleExperience employees={employees} />;
}
