"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Heart,
  Scissors,
  Sparkles,
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
import styles from "./about.module.css";

const offers = [
  {
    title: "Hair & styling",
    tag: "A FRESH CHAPTER",
    details: "Cuts · Color · Blowouts",
    description: "Cuts, color, and styling with a little more you in every detail.",
    image: "hair",
    alt: "Hair stylist working on a client's brunette hair",
    icon: Scissors,
  },
  {
    title: "Beauty & glow",
    tag: "YOUR RESET RITUAL",
    details: "Facials · Beauty · Care",
    description: "Feel-good skin care and beauty moments that let you slow down.",
    image: "beauty",
    alt: "Beauty therapist applying a facial mask with a brush",
    icon: Sparkles,
  },
  {
    title: "Barber & grooming",
    tag: "LOOK SHARP. FEEL GOOD.",
    details: "Fades · Trims · Beards",
    description: "Fresh cuts, neat beards, and a finish that feels effortless.",
    image: "barber",
    alt: "Barber carefully trimming a client's hair in front of a mirror",
    icon: Scissors,
  },
];

export function AboutExperience({
  brandName,
  people,
}: {
  brandName: string;
  people: TeamMember[];
}) {
  const { openBooking } = useBooking();

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#story">
        Skip to our story
      </a>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span aria-current="page">About us</span>
            </nav>
            <p className={styles.pill}>
              <Heart size={13} /> A LITTLE ABOUT {brandName.toUpperCase()}
            </p>
            <h1>
              Come in.
              <br />
              Settle in.
              <br />
              <span>Be you.</span>
            </h1>
            <p>
              Hair, beauty, and grooming under one roof — with care that
              starts as a conversation, not a checklist.
            </p>
            <button
              className={styles.primaryButton}
              onClick={() => openBooking()}
            >
              Book a visit <ArrowUpRight size={17} />
            </button>
            <div className={styles.heroNotes}>
              <span>
                <Check size={14} /> Your choice of stylist
              </span>
              <span>
                <Check size={14} /> Easy online scheduling
              </span>
            </div>
          </div>
          <div className={styles.heroPhotos}>
            <div className={styles.heroPhoto}>
              <Image
                src="/images/styledesk/consult.webp"
                alt="Stylist talking through a look with a guest"
                fill
                priority
                sizes="(max-width:760px) 62vw, 30vw"
              />
              <span>
                <Heart size={16} /> A conversation before the transformation.
              </span>
            </div>
            <div className={styles.smallPhoto}>
              <Image
                src="/images/styledesk/studio.webp"
                alt="Contemporary salon interior with styling stations"
                fill
                sizes="(max-width:760px) 34vw, 17vw"
              />
            </div>
            <span className={styles.heroSpark} aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
        <section id="story" className={styles.story}>
          <div className={styles.spacePhoto}>
            <Image
              src="/images/styledesk/studio.webp"
              alt="Bright salon interior with illuminated mirrors"
              fill
              sizes="(max-width:760px) 90vw, 50vw"
            />
            <span>
              <Sparkles size={18} /> YOUR SELF-CARE STARTS HERE
            </span>
          </div>
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>WHY WE OPENED THE DOORS</p>
            <h2>
              Your look matters.
              <br />
              <span>So does your experience.</span>
            </h2>
            <p>
              {brandName} is a happy place for hair, beauty, and grooming. We
              built it for the days you want a fresh start, a little glow, or
              simply an hour that belongs to you.
            </p>
            <div className={styles.values}>
              <span>
                <Heart size={20} />
                <strong>Care that feels personal</strong>
                <small>A conversation before the transformation.</small>
              </span>
              <span>
                <Scissors size={20} />
                <strong>Room for every style</strong>
                <small>Hair, beauty, and barbering under one roof.</small>
              </span>
              <span>
                <Sparkles size={20} />
                <strong>Easy from the first tap</strong>
                <small>Choose your ritual, pick a time, and we’ll see you soon.</small>
              </span>
            </div>
            <Link className={styles.textLink} href="/services">
              Explore the menu <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className={styles.offer} aria-labelledby="offer-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>WHAT WE LOVE DOING</p>
              <h2 id="offer-title">
                Good looks come in
                <br />
                <span>your kind of style.</span>
              </h2>
            </div>
            <div>
              <p>
                Everyday upkeep or a whole new era.
                <br />
                There’s something here for your mood.
              </p>
              <Link className={styles.textLink} href="/packages">
                See bundled visits <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <div className={styles.offerGrid}>
            {offers.map((offer) => (
              <Link
                href="/services"
                className={styles.offerCard}
                key={offer.title}
              >
                <div className={styles.offerPhoto}>
                  <Image
                    src={`/images/styledesk/${offer.image}.webp`}
                    alt={offer.alt}
                    fill
                    sizes="(max-width:760px) 90vw, 33vw"
                  />
                  <span>
                    <offer.icon size={16} />
                    {offer.details}
                  </span>
                </div>
                <div className={styles.offerCopy}>
                  <p className={styles.eyebrow}>{offer.tag}</p>
                  <h3>
                    {offer.title}
                    <span>
                      <ArrowUpRight size={21} />
                    </span>
                  </h3>
                  <p>{offer.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        {people.length > 0 && (
          <section className={styles.people} aria-labelledby="people-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>THE PEOPLE YOU’LL MEET</p>
                <h2 id="people-title">
                  Faces you’ll be <span>glad to see.</span>
                </h2>
              </div>
              <div>
                <p>
                  A team that listens first, then gets to work
                  <br />
                  on the look you actually want.
                </p>
                <Link className={styles.textLink} href="/our-team">
                  Meet everyone <ArrowUpRight size={17} />
                </Link>
              </div>
            </div>
            <div className={styles.peopleGrid}>
              {people.map((member) => {
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
              })}
            </div>
          </section>
        )}
        <section className={styles.finalCta}>
          <span aria-hidden="true" className={styles.ctaDecoration}>
            ✳
          </span>
          <div>
            <p className={styles.eyebrow}>THIS IS YOUR SIGN</p>
            <h2>
              Make yourself
              <br />a priority.
            </h2>
            <p>
              The fresh-cut feeling. The post-facial glow.
              <br />
              Whatever you need, let’s make time for it.
            </p>
          </div>
          <button className={styles.ctaButton} onClick={() => openBooking()}>
            My next good-hair day <ArrowUpRight size={23} />
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
