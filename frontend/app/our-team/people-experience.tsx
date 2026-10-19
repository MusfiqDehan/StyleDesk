"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Heart,
  Scissors,
  Sparkles,
  Users,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { useBooking } from "@/context/BookingContext";
import { getMediaUrl } from "@/lib/utils";
import { formatEmployeeRoleLabel } from "@/lib/employee-roles";
import {
  memberBio,
  memberInitials,
  memberRoleLabel,
  type TeamMember,
} from "@/lib/team-presentation";
import styles from "./people.module.css";

export function PeopleExperience({ employees }: { employees: TeamMember[] }) {
  const { openBooking } = useBooking();

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#people">
        Skip to our people
      </a>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span aria-current="page">Our people</span>
            </nav>
            <p className={styles.pill}>
              <Users size={13} /> THE FACES BEHIND YOUR GLOW
            </p>
            <h1>
              Meet the people
              <br />
              <span>who get you.</span>
            </h1>
            <p>
              A conversation first. Then the cut, the color, the glow.
              <br />
              Find someone whose style feels like yours.
            </p>
            <button
              className={styles.primaryButton}
              onClick={() => openBooking()}
            >
              Book with someone you like <ArrowUpRight size={17} />
            </button>
            <div className={styles.heroNotes}>
              <span>
                <Check size={14} /> Your choice of stylist
              </span>
              <span>
                <Heart size={14} /> Care that feels personal
              </span>
            </div>
          </div>
          <div className={styles.heroPhotos}>
            <div className={styles.heroPhoto}>
              <Image
                src="/images/styledesk/team.webp"
                alt="Stylist coloring a guest's hair in the salon"
                fill
                priority
                sizes="(max-width:760px) 62vw, 30vw"
              />
              <span>
                <Scissors size={16} /> Listened to. Looked after.
              </span>
            </div>
            <div className={styles.smallPhoto}>
              <Image
                src="/images/styledesk/wash.webp"
                alt="Close-up of a precise haircut in progress"
                fill
                sizes="(max-width:760px) 34vw, 17vw"
              />
            </div>
            <span className={styles.heroSpark} aria-hidden="true">
              ✳
            </span>
            <div className={styles.photoNote}>
              <Sparkles size={19} />
              <span>
                Skill, plus a little kindness.
                <br />
                <strong>That’s the whole idea.</strong>
              </span>
            </div>
          </div>
        </section>
        <section
          id="people"
          className={styles.roster}
          aria-labelledby="people-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>YOUR NEXT CHAIR, YOUR PERSON</p>
              <h2 id="people-title">
                Artists, hosts, <span>and helping hands.</span>
              </h2>
            </div>
            <p>
              Browse the team, then book with the stylist
              <br />
              you’d like in your chair.
            </p>
          </div>
          <div className={styles.grid}>
            {employees.length === 0 ? (
              <div className={styles.empty}>
                <span>
                  <Users size={28} />
                </span>
                <h3>The team page is getting a refresh.</h3>
                <p>
                  We’re updating who’s in the chair. Book a visit and we’ll
                  match you with someone great.
                </p>
                <button
                  className={styles.primaryButton}
                  onClick={() => openBooking()}
                >
                  Book an appointment <ArrowUpRight size={17} />
                </button>
              </div>
            ) : (
              employees.map((member) => {
                const image = getMediaUrl(member.image);
                return (
                  <Link
                    href={`/our-team/${member.id}`}
                    className={styles.personCard}
                    key={member.id}
                  >
                    <div className={styles.personPhoto}>
                      {image ? (
                        <img src={image} alt={member.name} />
                      ) : (
                        <span className={styles.initials}>
                          {memberInitials(member.name)}
                        </span>
                      )}
                    </div>
                    <div className={styles.personCopy}>
                      <p className={styles.eyebrow}>
                        {formatEmployeeRoleLabel(memberRoleLabel(member))}
                      </p>
                      <h3>
                        {member.name}
                        <ArrowUpRight size={18} />
                      </h3>
                      <p>{memberBio(member)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
        <section className={styles.help}>
          <div>
            <p className={styles.eyebrow}>NOT SURE WHO TO PICK?</p>
            <h2>
              Start with a time. <span>We’ll take it from there.</span>
            </h2>
            <p>
              Book the visit, tell us what you have in mind, and we’ll sit you
              with someone who fits the mood.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => openBooking()}
          >
            Find my moment <ArrowUpRight size={19} />
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
