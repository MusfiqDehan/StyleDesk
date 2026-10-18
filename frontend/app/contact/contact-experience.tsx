"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { useBooking } from "@/context/BookingContext";
import { useBusiness } from "@/context/BusinessContext";
import { resolveBusinessName } from "@/lib/business-branding";
import { toGoogleMapsEmbedUrl } from "@/lib/google-maps-embed";
import { toast } from "@/lib/toast";
import styles from "./contact.module.css";

export function ContactExperience() {
  const { openBooking } = useBooking();
  const { businessInfo, businessName } = useBusiness();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const brandName = resolveBusinessName(
    businessInfo?.businessName || businessName,
  );
  const contactEmail = businessInfo?.email || "hello@styledesk.com";
  const contactPhone = businessInfo?.phone || "+880 0000-000000";
  const contactAddress =
    businessInfo?.address || "Mirpur DOHS, Pallabi, Dhaka 1216, Bangladesh";
  const customTitle = businessInfo?.contactSectionTitle?.trim();
  const sectionTitle = customTitle || "Tell us what you have in mind.";
  const sectionDescription =
    businessInfo?.contactSectionDescription?.trim() ||
    "A question about a service, a package, or just when to come in. We’ll help you plan the visit.";
  const cleanPhone = useMemo(
    () => contactPhone.replace(/\s+/g, ""),
    [contactPhone],
  );
  const mapsUrl = useMemo(
    () =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactAddress)}`,
    [contactAddress],
  );
  const mapEmbedUrl = useMemo(
    () => toGoogleMapsEmbedUrl(businessInfo?.mapEmbedUrl, contactAddress),
    [businessInfo?.mapEmbedUrl, contactAddress],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }
    const subject = `A note from ${name.trim()}`;
    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Phone: ${phone.trim() || "N/A"}`,
      "",
      "Message:",
      message.trim(),
    ].join("\n");
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success("Your email app is opening with the message.");
  };

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#write">
        Skip to message form
      </a>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span aria-current="page">Contact</span>
            </nav>
            <p className={styles.pill}>
              <MessageCircle size={13} /> STILL CURIOUS? LET’S TALK
            </p>
            <h1>
              Say hello.
              <br />
              <span>We’ll take it from there.</span>
            </h1>
            <p>
              A question, a date that works, or a little advice before you
              book. Reach out — we’re happy to help you plan the visit.
            </p>
            <a className={styles.primaryButton} href="#write">
              Send a message <ArrowUpRight size={17} />
            </a>
            <div className={styles.heroNotes}>
              <span>
                <Check size={14} /> We usually reply within a day
              </span>
              <span>
                <Heart size={14} /> Or just book when you’re ready
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
                <MessageCircle size={16} /> A conversation, not a formality.
              </span>
            </div>
            <div className={styles.smallPhoto}>
              <Image
                src="/images/styledesk/studio.webp"
                alt="Bright salon interior with styling stations"
                fill
                sizes="(max-width:760px) 34vw, 17vw"
              />
            </div>
            <span className={styles.heroSpark} aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
        <section
          className={styles.reach}
          aria-labelledby="reach-title"
          id="reach"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>A FEW EASY WAYS IN</p>
              <h2 id="reach-title">
                Call, write, <span>or come by.</span>
              </h2>
            </div>
            <p>
              Pick whatever feels easiest.
              <br />
              We’ll meet you there.
            </p>
          </div>
          <div className={styles.reachGrid}>
            <a className={styles.reachCard} href={`tel:${cleanPhone}`}>
              <span>
                <Phone size={16} />
              </span>
              <p className={styles.eyebrow}>CALL</p>
              <h3>Give us a ring</h3>
              <strong>{contactPhone}</strong>
              <small>Best for a quick question or same-week visit.</small>
            </a>
            <a className={styles.reachCard} href={`mailto:${contactEmail}`}>
              <span>
                <Mail size={16} />
              </span>
              <p className={styles.eyebrow}>EMAIL</p>
              <h3>Drop a note</h3>
              <strong>{contactEmail}</strong>
              <small>Tell us the mood, the occasion, or the date you have in mind.</small>
            </a>
            <a
              className={styles.reachCard}
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <MapPin size={16} />
              </span>
              <p className={styles.eyebrow}>VISIT</p>
              <h3>Come see us</h3>
              <strong>{contactAddress}</strong>
              <small>Open in Google Maps when you’re on the way.</small>
            </a>
          </div>
        </section>
        <section className={styles.write} id="write" aria-labelledby="write-title">
          <div className={styles.writeLayout}>
            <div className={styles.writeCopy}>
              <p className={styles.eyebrow}>SEND A LITTLE NOTE</p>
              <h2 id="write-title">
                {sectionTitle}
                {!customTitle ? (
                  <>
                    {" "}
                    <span>We’re listening.</span>
                  </>
                ) : null}
              </h2>
              <p>{sectionDescription}</p>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Alex Rahman"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Phone (optional)</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 01712345678"
                    autoComplete="tel"
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={`Hi ${brandName} team, I would like to…`}
                    required
                  />
                </label>
              </div>
              <div className={styles.formFooter}>
                <p>We’ll get back to you as soon as we can — usually within a day.</p>
                <button type="submit" className={styles.primaryButton}>
                  Send message <ArrowUpRight size={17} />
                </button>
              </div>
            </form>
          </div>
        </section>
        <section className={styles.map} aria-labelledby="map-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>FIND THE DOOR</p>
              <h2 id="map-title">
                Come in. <span>Settle in.</span>
              </h2>
            </div>
            <p>
              {contactAddress}
              <br />
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </p>
          </div>
          <div className={styles.mapFrame}>
            <iframe
              title={`${brandName} location`}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
        <section className={styles.help}>
          <div>
            <p className={styles.eyebrow}>READY WHEN YOU ARE</p>
            <h2>
              Or skip the note <span>and book it.</span>
            </h2>
            <p>
              If you already know the ritual, put yourself on the calendar.
              We’ll see you in the chair.
            </p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openBooking()}
          >
            Book a visit <ArrowUpRight size={19} />
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
