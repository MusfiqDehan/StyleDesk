import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowUpRight, Award, Users } from "lucide-react";
import api from "@admin/api/base";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { getMediaUrl } from "@/lib/utils";
import {
  formatEmployeeRoleLabel,
  isArtistEmployeeRole,
} from "@/lib/employee-roles";
import {
  memberBio,
  memberInitials,
  memberRoleLabel,
  memberSpecialties,
  type TeamMember,
} from "@/lib/team-presentation";
import { MemberBookingButton } from "../member-booking-button";
import styles from "../people.module.css";

export const dynamic = "force-dynamic";

async function fetchMember(id: string): Promise<TeamMember | null> {
  const res = await api.get("/employee/basic", { cache: false as any });
  const teamArray = Array.isArray(res.data)
    ? res.data
    : res.data?.data || res.data?.items || [];
  return teamArray.find((employee: TeamMember) => employee.id === id) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const path = `/our-team/${id}`;
  try {
    const employee = await fetchMember(id);
    if (employee?.name) {
      const specialties = memberSpecialties(employee).slice(0, 3).join(", ");
      return pageMetadata({
        title: `${employee.name} — ${memberRoleLabel(employee)}`,
        path,
        description: `Meet ${employee.name}${specialties ? `, specialising in ${specialties}` : ""}. See their experience and book a salon appointment online.`,
      });
    }
  } catch {
    /* fall through */
  }
  return pageMetadata({
    title: "Our stylists & team",
    path,
    description: "Meet our stylists, barbers, and beauty artists and book online.",
    noindex: true,
  });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let employee: TeamMember | null = null;
  try {
    employee = await fetchMember(id);
  } catch (error) {
    console.error("Failed to fetch employee:", error);
  }

  if (!employee) {
    return (
      <div className={styles.page}>
        <PublicHeader />
        <main>
          <div className={styles.detail}>
            <div className={styles.empty}>
              <span>
                <Users size={28} />
              </span>
              <h3>We couldn’t find that teammate.</h3>
              <p>They may have moved chairs. Meet the rest of the team.</p>
              <Link className={styles.primaryButton} href="/our-team">
                Back to our people <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const image = getMediaUrl(employee.image);
  const specialties = memberSpecialties(employee);
  const experience = Number(employee.experience) || 0;

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#member">
        Skip to profile
      </a>
      <PublicHeader />
      <main>
        <section className={styles.detail} id="member">
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/our-team">Our people</Link>
            <span>/</span>
            <span aria-current="page">{employee.name}</span>
          </nav>
          <div className={styles.detailLayout}>
            <div className={styles.detailPhoto}>
              {image ? (
                <img src={image} alt={employee.name} />
              ) : (
                <span className={styles.initials} style={{ fontSize: 88 }}>
                  {memberInitials(employee.name)}
                </span>
              )}
            </div>
            <div className={styles.detailCopy}>
              <p className={styles.pill}>
                {formatEmployeeRoleLabel(memberRoleLabel(employee))}
              </p>
              <h1>
                {employee.name.split(" ")[0]}
                <br />
                <span>
                  {employee.name.split(" ").slice(1).join(" ") || "in your chair."}
                </span>
              </h1>
              <div className={styles.meta}>
                {experience > 0 && (
                  <span>
                    <Award size={14} />
                    {experience}+ years in the craft
                  </span>
                )}
              </div>
              <p className={styles.bio}>{memberBio(employee)}</p>
              {specialties.length > 0 && (
                <div className={styles.specialties}>
                  <h2>Especially good at</h2>
                  <div className={styles.chips}>
                    {specialties.map((spec) => (
                      <span key={spec}>{spec}</span>
                    ))}
                  </div>
                </div>
              )}
              {isArtistEmployeeRole(employee.role) && (
                <MemberBookingButton stylistName={employee.name} />
              )}
              <Link className={styles.textLink} href="/our-team">
                Meet everyone <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
