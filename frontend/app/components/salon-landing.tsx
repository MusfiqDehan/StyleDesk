"use client";

import Image from "next/image";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useBooking } from "@/context/BookingContext";
import styles from "./salon-landing.module.css";

const services = [
  {
    title: "Hair & styling",
    tag: "A FRESH CHAPTER",
    description:
      "Cuts, color, and styling with a little more you in every detail.",
    image: "hair",
    alt: "Hair stylist working on a client's brunette hair",
    details: "Cuts · Color · Blowouts",
    icon: Scissors,
  },
  {
    title: "Beauty & glow",
    tag: "YOUR RESET RITUAL",
    description:
      "Feel-good skin care and beauty moments that let you slow down.",
    image: "beauty",
    alt: "Beauty therapist applying a facial mask with a brush",
    details: "Facials · Beauty · Care",
    icon: Sparkles,
  },
  {
    title: "Barber & grooming",
    tag: "LOOK SHARP. FEEL GOOD.",
    description: "Fresh cuts, neat beards, and a finish that feels effortless.",
    image: "barber",
    alt: "Barber carefully trimming a client's hair in front of a mirror",
    details: "Fades · Trims · Beards",
    icon: Scissors,
  },
];
const questions = [
  {
    title: "How do I book an appointment?",
    answer:
      "Select Book an appointment and sign in or create an account. Choose your services, stylist, date, and time, then review your details before confirming.",
  },
  {
    title: "Can I book more than one service?",
    answer:
      "Yes. Add services or packages to your booking bag, review the quantities, and continue to scheduling from the bag.",
  },
  {
    title: "Where can I see my appointments?",
    answer:
      "Sign in and open My appointments to view your scheduled visits and booking details.",
  },
];

export function SalonLanding() {
  const { openBooking } = useBooking();
  const book = () => {
    openBooking();
  };

  return (
    <div className={styles.site}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <PublicHeader />
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.pill}>
              <Sparkles size={14} /> YOUR NEXT FEEL-GOOD STARTS HERE
            </p>
            <h1 id="hero-title">
              A little glow.
              <br />A fresh look.
              <br />
              <span>All you.</span>
              <span className={styles.heroSpark} aria-hidden="true">
                ✳
              </span>
            </h1>
            <p className={styles.intro}>
              Your hair, beauty, and grooming rituals, all in one happy place.
              Make a little time for a more confident you.
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} onClick={book}>
                Book an appointment <ArrowUpRight size={19} />
              </button>
              <a className={styles.secondaryButton} href="#services">
                Find my service <ArrowRight size={17} />
              </a>
            </div>
            <div className={styles.heroFootnote}>
              <span>
                <Check size={14} /> Your choice of stylist
              </span>
              <span>
                <Check size={14} /> Easy online scheduling
              </span>
            </div>
          </div>
          <div className={styles.collage}>
            <div className={styles.mainPhoto}>
              <Image
                src="/images/styledesk/hair.webp"
                alt="A salon stylist tending to a guest's hair"
                fill
                priority
                loading="eager"
                sizes="(max-width: 760px) 68vw, 32vw"
              />
              <span className={styles.photoPill}>
                <Scissors size={14} /> Good hair. Great energy.
              </span>
            </div>
            <div className={styles.sidePhoto}>
              <Image
                src="/images/styledesk/barber.webp"
                alt="A barber creating a fresh haircut"
                fill
                sizes="(max-width: 760px) 38vw, 20vw"
              />
            </div>
            <span className={styles.orbit} aria-hidden="true">
              ✳
            </span>
            <div className={styles.careCard}>
              <span>
                <Heart size={20} />
              </span>
              <div>
                <strong>A moment, just for you.</strong>
                <p>Put yourself on the calendar.</p>
              </div>
            </div>
            <a className={styles.collageLink} href="#booking">
              <CalendarDays size={20} />
              <span>
                Goodbye, booking hassle.
                <br />
                <strong>Hello, me-time.</strong>
              </span>
              <ArrowUpRight size={21} />
            </a>
          </div>
        </section>
        <section
          className={styles.quickBar}
          aria-label="Explore your next visit"
        >
          <span>WHAT ARE YOU IN THE MOOD FOR?</span>
          <a href="#services">
            <Scissors size={17} /> A new look <ArrowUpRight size={15} />
          </a>
          <a href="#services">
            <Sparkles size={17} /> A little glow <ArrowUpRight size={15} />
          </a>
          <Link href="/packages">
            <Heart size={17} /> The whole experience <ArrowUpRight size={15} />
          </Link>
        </section>
        <section id="services" className={styles.services}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>THE SELF-CARE MENU</p>
              <h2>
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
              <Link className={styles.textLink} href="/services">
                Explore all services <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <Link
                href="/services"
                className={styles.serviceCard}
                key={service.title}
              >
                <div className={styles.servicePhoto}>
                  <Image
                    src={`/images/styledesk/${service.image}.webp`}
                    alt={service.alt}
                    fill
                    sizes="(max-width: 760px) 90vw, 33vw"
                  />
                  <span>
                    <service.icon size={16} />
                    {service.details}
                  </span>
                </div>
                <div className={styles.serviceCopy}>
                  <p className={styles.eyebrow}>{service.tag}</p>
                  <h3>
                    {service.title}
                    <span>
                      <ArrowUpRight size={21} />
                    </span>
                  </h3>
                  <p>{service.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section id="booking" className={styles.booking}>
          <div className={styles.bookingLead}>
            <p className={styles.eyebrow}>BOOK IT. LOVE IT. REPEAT.</p>
            <h2>
              Less back-and-forth.
              <br />
              <span>More you-time.</span>
            </h2>
            <p>
              From “I need a change” to “see you soon.”
              <br />
              Your next visit is just a few steps away.
            </p>
            <button className={styles.primaryButton} onClick={book}>
              Let’s find your moment <ArrowUpRight size={19} />
            </button>
            <small>Sign in to view services and schedule your visit.</small>
          </div>
          <div className={styles.steps}>
            {[
              {
                title: "Choose your ritual",
                text: "Find your service or build your own combination in your booking bag.",
                icon: Sparkles,
              },
              {
                title: "Pick your people & time",
                text: "Choose your stylist and schedule a date and time that work for you.",
                icon: CalendarDays,
              },
              {
                title: "Make it official",
                text: "Review your details and confirm. We’ll see you in the chair.",
                icon: Check,
              },
            ].map((step, i) => (
              <div className={styles.step} key={step.title}>
                <span className={styles.stepNumber}>0{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <step.icon size={22} />
              </div>
            ))}
          </div>
        </section>
        <section id="experience" className={styles.experience}>
          <div className={styles.spacePhoto}>
            <Image
              src="/images/styledesk/studio.webp"
              alt="Contemporary beauty salon with illuminated mirrors and styling stations"
              fill
              sizes="(max-width: 760px) 90vw, 50vw"
            />
            <span>
              <Sparkles size={18} /> YOUR SELF-CARE STARTS HERE
            </span>
          </div>
          <div className={styles.experienceCopy}>
            <p className={styles.eyebrow}>COME IN. SETTLE IN. BE YOU.</p>
            <h2>
              Your look matters.
              <br />
              <span>So does your experience.</span>
            </h2>
            <p>
              A great salon visit is more than the final reveal. It’s being
              listened to, feeling at ease, and knowing the little details are
              taken care of.
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
            </div>
            <Link className={styles.textLink} href="/our-team">
              Meet your next stylist <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className={styles.faq}>
          <div>
            <p className={styles.eyebrow}>A FEW THINGS TO KNOW</p>
            <h2>
              Before you
              <br />
              <span>make it a date.</span>
            </h2>
            <Link className={styles.textLink} href="/contact">
              Still curious? Get in touch <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className={styles.questions}>
            {questions.map((question) => (
              <details key={question.title}>
                <summary>
                  {question.title}
                  <ChevronDown size={18} />
                </summary>
                <p>{question.answer}</p>
              </details>
            ))}
          </div>
        </section>
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
          <button className={styles.ctaButton} onClick={book}>
            My next good-hair day <ArrowUpRight size={23} />
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
