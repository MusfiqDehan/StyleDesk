"use client";
import { ModernSelect } from "@/components/ui/modern-select";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Gift,
  Heart,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { useCart } from "@/context/CartContext";
import { useBusiness } from "@/context/BusinessContext";
import {
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSort,
  sortCatalogItems,
  type CatalogSortOrder,
} from "@/lib/catalog-sort";
import type { SalonPackage } from "@/lib/package-presentation";
import styles from "./packages.module.css";
import PackagesGrid from "./PackagesGrid";

const reasons = [
  {
    title: "One visit, the full ritual",
    text: "Pair the treatments you love so your next appointment feels complete from the first hello.",
  },
  {
    title: "Easier on the calendar",
    text: "Skip the guesswork. A package keeps your favorites together in your booking bag.",
  },
  {
    title: "A little extra value",
    text: "Thoughtfully bundled care, priced as a whole experience instead of a pile of extras.",
  },
];

export function PackagesExperience() {
  const { businessInfo } = useBusiness();
  const { items, openCart } = useCart();
  const [packages, setPackages] = useState<SalonPackage[]>([]);
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [sortOverride, setSortOverride] = useState<CatalogSortOrder | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const sort =
    sortOverride ?? normalizeCatalogSort(businessInfo?.packagesSortOrder);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 10000);
    setStatus("loading");
    async function load() {
      try {
        const response = await fetch(
          `${"/api/backend"}/makeover-packages`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Catalog unavailable");
        const data: unknown = await response.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { data?: unknown })?.data)
            ? (data as { data: SalonPackage[] }).data
            : null;
        if (!list) throw new Error("Invalid catalog");
        if (!disposed) {
          setPackages(list);
          setStatus("ready");
        }
      } catch {
        if (!disposed) setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const categories = [
    "All",
    ...new Set(
      packages
        .map((pkg) => pkg.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ];

  const filtered = useMemo(
    () =>
      sortCatalogItems(
        packages.filter(
          (pkg) =>
            (active === "All" ||
              (pkg.category || "").toLowerCase() === active.toLowerCase()) &&
            `${pkg.title} ${pkg.category || ""} ${pkg.description || ""}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        ),
        sort,
      ),
    [packages, active, search, sort],
  );

  const bagCount = items.filter((item) => item.type === "package").reduce(
    (sum, item) => sum + item.qty,
    0,
  );

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#package-menu">
        Skip to packages
      </a>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span aria-current="page">Packages</span>
            </nav>
            <p className={styles.pill}>
              <Gift size={13} /> THE WHOLE EXPERIENCE
            </p>
            <h1>
              Bundle your
              <br />
              <span>feel-good favorites.</span>
            </h1>
            <p>
              Hair, glow, and a little extra care — already put together.
              <br />
              Pick a package, add it to your bag, and make the visit yours.
            </p>
            <a className={styles.primaryButton} href="#package-menu">
              Explore packages <ArrowDown size={17} />
            </a>
            <div className={styles.heroNotes}>
              <span>
                <Check size={14} /> Treatments, already paired
              </span>
              <span>
                <Heart size={14} /> Easy to add to your bag
              </span>
            </div>
          </div>
          <div className={styles.heroPhotos}>
            <div className={styles.heroPhoto}>
              <Image
                src="/images/styledesk/spa.webp"
                alt="Guest receiving a calming facial treatment"
                fill
                priority
                sizes="(max-width:760px) 62vw, 30vw"
              />
              <span>
                <Sparkles size={16} /> More you-time, less deciding.
              </span>
            </div>
            <div className={styles.smallPhoto}>
              <Image
                src="/images/styledesk/color.webp"
                alt="Stylist sectioning hair during a color appointment"
                fill
                sizes="(max-width:760px) 34vw, 17vw"
              />
            </div>
            <span className={styles.heroSpark} aria-hidden="true">
              ✳
            </span>
            <div className={styles.photoNote}>
              <Gift size={19} />
              <span>
                Not just one service.
                <br />
                <strong>A complete little ritual.</strong>
              </span>
            </div>
          </div>
        </section>
        <section className={styles.reasons} aria-labelledby="reasons-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>WHY A PACKAGE FEELS BETTER</p>
              <h2 id="reasons-title">
                Less picking. <span>More settling in.</span>
              </h2>
            </div>
            <p>
              Built for the days you want the full reset
              <br />
              without assembling it yourself.
            </p>
          </div>
          <div className={styles.reasonGrid}>
            {reasons.map((reason, index) => (
              <div className={styles.reason} key={reason.title}>
                <span className={styles.reasonNumber}>0{index + 1}</span>
                <div>
                  <h3>{reason.title}</h3>
                  <p>{reason.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          id="package-menu"
          className={styles.menu}
          aria-labelledby="menu-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>PICK YOUR COMBINATION</p>
              <h2 id="menu-title">
                Find a bundle <span>that fits your mood.</span>
              </h2>
            </div>
            <p>
              Add a package to your bag, then choose
              <br />
              your people and your time.
            </p>
          </div>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <Search size={18} />
              <input
                aria-label="Search packages"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a package, occasion, or little luxury…"
              />
            </div>
            <label className={styles.sort}>
              <SlidersHorizontal size={16} />
              <span className={styles.srOnly}>Sort packages</span>
              <ModernSelect
                aria-label="Sort packages"
                value={sort}
                onChange={(event) =>
                  setSortOverride(normalizeCatalogSort(event.target.value))
                }
              >
                {CATALOG_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </ModernSelect>
            </label>
          </div>
          {categories.length > 1 && (
            <div
              className={styles.filters}
              role="group"
              aria-label="Filter packages by category"
            >
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  aria-pressed={active === category}
                  onClick={() => setActive(category)}
                >
                  {category === "All" ? "All packages" : category}
                </button>
              ))}
            </div>
          )}
          <div className={styles.resultsInfo} aria-live="polite">
            <span>
              {status === "loading"
                ? "Gathering your next ritual…"
                : status === "error"
                  ? "Packages are temporarily unavailable"
                  : `${filtered.length} ${filtered.length === 1 ? "package" : "packages"}${active !== "All" ? ` in ${active.toLowerCase()}` : " to explore"}`}
            </span>
            {(search || active !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setActive("All");
                }}
              >
                Clear filters <X size={13} />
              </button>
            )}
          </div>
          {status === "loading" ? (
            <div className={styles.loading} role="status">
              <Sparkles size={28} />
              <p>Getting the packages ready for you…</p>
            </div>
          ) : status === "error" ? (
            <div className={styles.empty} role="alert">
              <span>
                <Gift size={28} />
              </span>
              <h3>A little pause in the plans.</h3>
              <p>
                We couldn’t load packages right now. Please try again in a
                moment.
              </p>
              <button
                className={styles.primaryButton}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again <ArrowRight size={17} />
              </button>
            </div>
          ) : !filtered.length ? (
            <div className={styles.empty}>
              <span>
                <Search size={28} />
              </span>
              <h3>
                {packages.length
                  ? "Let’s try a different mix."
                  : "Your next bundle is on its way."}
              </h3>
              <p>
                {packages.length
                  ? "We couldn’t find a match. Try another word or explore all packages."
                  : "Our package menu is being prepared. Get in touch and we’ll help you plan a visit."}
              </p>
              {packages.length ? (
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    setSearch("");
                    setActive("All");
                  }}
                >
                  Show all packages <ArrowRight size={17} />
                </button>
              ) : (
                <Link className={styles.primaryButton} href="/contact">
                  Help me plan a visit <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
          ) : (
            <PackagesGrid packages={filtered} />
          )}
          {status === "ready" && filtered.length > 0 && (
            <div className={styles.bagPrompt}>
              <span>
                <Check size={16} /> Found a favorite? Your booking bag keeps
                packages and services together.
                {bagCount ? ` (${bagCount} in bag)` : ""}
              </span>
              <button onClick={openCart}>
                Review my bag <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <section className={styles.help}>
          <div>
            <p className={styles.eyebrow}>WANT SOMETHING MORE SPECIFIC?</p>
            <h2>
              We’ll help you <span>build it.</span>
            </h2>
            <p>
              Tell us the occasion, the mood, or the treatments you have in
              mind. We’ll shape a visit that feels like yours.
            </p>
          </div>
          <Link href="/contact" className={styles.primaryButton}>
            Talk to our team <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
