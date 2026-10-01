"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { TenantBrand } from "@/components/tenant-brand";
import { CalendarDays, Heart, Sparkles } from "lucide-react";
import { useBusiness } from "@/context/BusinessContext";
import styles from "./auth.module.css";
import { BackToWebsite } from "./back-to-website";

export function AuthShell({
  children,
  mode = "login",
}: {
  children: ReactNode;
  mode?: "login" | "register" | "verify";
}) {
  const { connectionStatus, refresh } = useBusiness();
  const joining = mode !== "login";
  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${styles.returnHeader}`}>
        <TenantBrand />
        <BackToWebsite />
      </header>
      <main className={styles.layout}>
        <aside className={styles.story} aria-label="Your salon experience">
          <p className={styles.eyebrow}>
            <Sparkles size={14} /> A LITTLE CARE. A LOT OF CONFIDENCE.
          </p>
          <h2>
            {joining ? (
              <>
                Good things
                <br />
                start with <span>you.</span>
              </>
            ) : (
              <>
                Your next
                <br />
                <span>feel-good</span> awaits.
              </>
            )}
          </h2>
          <p className={styles.storyIntro}>
            {joining
              ? "A fresh cut, a little glow, a moment to reset. Make space for the things that make you feel like you."
              : "Your favorite rituals. Your next appointment. A little time for yourself, all in one place."}
          </p>
          <div className={styles.photo}>
            <Image
              src={`/images/styledesk/${joining ? "beauty" : "hair"}.webp`}
              alt={
                joining
                  ? "Beauty therapist providing a relaxing facial treatment"
                  : "Hair stylist caring for a guest's hair"
              }
              fill
              priority
              sizes="(max-width: 760px) 0px, 45vw"
            />
            <span className={styles.photoCaption}>
              <Heart size={17} />{" "}
              {joining
                ? "Self-care looks good on you."
                : "Your chair. Your moment."}
            </span>
            <span className={styles.photoSpark} aria-hidden="true">
              ✳
            </span>
          </div>
          <div className={styles.storyFooter}>
            <span>
              <CalendarDays size={18} /> Make time for your next look.
            </span>
            <span>HAIR · BEAUTY · BARBERING</span>
          </div>
        </aside>
        <section className={styles.formArea}>
          <div className={styles.formContent}>
            <nav className={styles.tabs} aria-label="Account access">
              <Link
                href="/login"
                aria-current={mode === "login" ? "page" : undefined}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                aria-current={joining ? "page" : undefined}
              >
                Create account
              </Link>
            </nav>
            {connectionStatus === "unavailable" && (
              <div className={styles.notice} role="status">
                <span>
                  We can’t reach the booking service right now. Please try again
                  in a moment.
                </span>
                <button type="button" onClick={() => void refresh()}>
                  Retry connection
                </button>
              </div>
            )}
            {children}
          </div>
          <p className={styles.footer}>
            Your style. Your time. Your place. <Sparkles size={13} />
          </p>
        </section>
      </main>
    </div>
  );
}
