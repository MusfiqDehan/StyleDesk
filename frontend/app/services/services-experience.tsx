"use client";
import { ModernSelect } from "@/components/ui/modern-select";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  Plus,
  Search,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { useCart } from "@/context/CartContext";
import { useBusiness } from "@/context/BusinessContext";
import { ServiceCategory, type Service } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSort,
  sortCatalogItems,
  type CatalogSortOrder,
} from "@/lib/catalog-sort";
import { serviceIntro, servicePhoto } from "@/lib/service-presentation";
import styles from "./services.module.css";

const edits = [
  {
    title: "The fresh-hair feeling",
    label: "CUT · COLOR · STYLE",
    category: ServiceCategory.HAIR,
    photo: "blowout",
    alt: "Stylist blow-drying a woman's hair",
    description:
      "Your usual, a little fresher. Or something completely new. Find your next hair moment.",
    icon: Scissors,
  },
  {
    title: "A little extra glow",
    label: "SKIN · BEAUTY · CARE",
    category: ServiceCategory.SKIN,
    photo: "beauty",
    alt: "A relaxing facial treatment",
    description:
      "Slow down, settle in, and give yourself the attention you deserve. This one’s for you.",
    icon: Heart,
  },
  {
    title: "Ready for your close-up",
    label: "MAKEUP · OCCASIONS · YOU",
    category: ServiceCategory.MAKEUP,
    photo: "makeup",
    alt: "Makeup brush applying a soft finish to a woman's face",
    description:
      "A soft touch or a statement look. Make your next occasion feel a little more special.",
    icon: Sparkles,
  },
];

export function ServicesExperience() {
  const { businessInfo } = useBusiness();
  const { addItem, items, openCart } = useCart();
  const [services, setServices] = useState<Service[]>([]);
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
    sortOverride ?? normalizeCatalogSort(businessInfo?.servicesSortOrder);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 10000);
    setStatus("loading");
    async function load() {
      try {
        const response = await fetch(
          `${"/api/backend"}/service/active`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Catalog unavailable");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid catalog");
        if (!disposed) {
          setServices(data);
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

  const filtered = useMemo(
    () =>
      sortCatalogItems(
        services.filter(
          (service) =>
            (active === "All" ||
              (active === "Barber"
                ? /barber|beard|shave|fade|groom|men.s/i.test(service.name)
                : service.category.toLowerCase() === active.toLowerCase())) &&
            `${service.name} ${service.category} ${service.description || ""}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        ),
        sort,
      ),
    [services, active, search, sort],
  );
  const categories = [
    "All",
    ...new Set([
      ...Object.values(ServiceCategory),
      "Barber",
      ...services.map((service) => service.category),
    ]),
  ];
  function selectCategory(category: string) {
    setActive(category);
    setSearch("");
  }

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#service-menu">
        Skip to service menu
      </a>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span aria-current="page">Our services</span>
            </nav>
            <p className={styles.pill}>
              <Sparkles size={13} /> THE FEEL-GOOD MENU
            </p>
            <h1>
              Find your ritual.
              <br />
              <span>Make it yours.</span>
            </h1>
            <p>
              A fresh cut. A soft glow. A little well-earned me-time.
              <br />
              Discover the care that fits your mood, your style, and your day.
            </p>
            <a className={styles.primaryButton} href="#service-menu">
              Explore the menu <ArrowDown size={17} />
            </a>
            <div className={styles.heroNotes}>
              <span>
                <Check size={14} /> Choose your services
              </span>
              <span>
                <CalendarDays size={14} /> Book on your schedule
              </span>
            </div>
          </div>
          <div className={styles.heroPhotos}>
            <div className={styles.heroPhoto}>
              <Image
                src="/images/styledesk/blowout.webp"
                alt="Salon stylist blow-drying a guest's hair"
                fill
                priority
                sizes="(max-width:760px) 62vw, 30vw"
              />
              <span>
                <Scissors size={16} /> Good hair starts here.
              </span>
            </div>
            <div className={styles.smallPhoto}>
              <Image
                src="/images/styledesk/makeup.webp"
                alt="A makeup brush adding a soft finish"
                fill
                sizes="(max-width:760px) 34vw, 17vw"
              />
            </div>
            <span className={styles.heroSpark} aria-hidden="true">
              ✳
            </span>
            <div className={styles.photoNote}>
              <Heart size={19} />
              <span>
                Not just a service.
                <br />
                <strong>A moment for yourself.</strong>
              </span>
            </div>
          </div>
        </section>
        <section className={styles.edits} aria-labelledby="edits-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>A LITTLE INSPIRATION</p>
              <h2 id="edits-title">
                What’s your <span>kind of care?</span>
              </h2>
            </div>
            <p>
              Start with a feeling.
              <br />
              Find a ritual to match.
            </p>
          </div>
          <div className={styles.editGrid}>
            {edits.map((edit) => (
              <a
                href="#service-menu"
                onClick={() => selectCategory(edit.category)}
                key={edit.title}
                className={styles.editCard}
              >
                <div className={styles.editPhoto}>
                  <Image
                    src={`/images/styledesk/${edit.photo}.webp`}
                    alt={edit.alt}
                    fill
                    sizes="(max-width:760px) 90vw, 33vw"
                  />
                  <span>
                    <edit.icon size={17} />
                  </span>
                </div>
                <div className={styles.editCopy}>
                  <p className={styles.eyebrow}>{edit.label}</p>
                  <h3>
                    {edit.title}
                    <ArrowUpRight size={20} />
                  </h3>
                  <p>{edit.description}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
        <section
          id="service-menu"
          className={styles.menu}
          aria-labelledby="menu-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>YOUR NEXT VISIT, YOUR WAY</p>
              <h2 id="menu-title">
                Build your <span>feel-good lineup.</span>
              </h2>
            </div>
            <p>
              Choose a little. Choose a lot.
              <br />
              Add your favorites, then pick your date and time.
            </p>
          </div>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <Search size={18} />
              <input
                aria-label="Search services"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a service, treatment, or new look…"
              />
            </div>
            <label className={styles.sort}>
              <SlidersHorizontal size={16} />
              <span className={styles.srOnly}>Sort services</span>
              <ModernSelect
                aria-label="Sort services"
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
          <div
            className={styles.filters}
            role="group"
            aria-label="Filter services by category"
          >
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                aria-pressed={active === category}
                onClick={() => setActive(category)}
              >
                {category === "All" ? "All services" : category}
              </button>
            ))}
          </div>
          <div className={styles.resultsInfo} aria-live="polite">
            <span>
              {status === "loading"
                ? "Finding your next feel-good…"
                : status === "error"
                  ? "The menu is temporarily unavailable"
                  : `${filtered.length} ${filtered.length === 1 ? "service" : "services"}${active !== "All" ? ` in ${active.toLowerCase()}` : " to explore"}`}
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
              <p>Getting the menu ready for you…</p>
            </div>
          ) : status === "error" ? (
            <div className={styles.empty} role="alert">
              <span>
                <CalendarDays size={28} />
              </span>
              <h3>A little pause in the plans.</h3>
              <p>
                We couldn’t load the service menu. Please try again in a moment.
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
                {services.length
                  ? "Let’s try a different look."
                  : "Your next ritual is on its way."}
              </h3>
              <p>
                {services.length
                  ? "We couldn’t find a match. Try another word or explore all services."
                  : "Our online service menu is being prepared. Get in touch and we’ll help you plan your visit."}
              </p>
              {services.length ? (
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    setSearch("");
                    setActive("All");
                  }}
                >
                  Show all services <ArrowRight size={17} />
                </button>
              ) : (
                <Link className={styles.primaryButton} href="/contact">
                  Help me plan a visit <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
          ) : (
            <div className={styles.catalog}>
              {filtered.map((service) => {
                const photo = servicePhoto(service);
                const quantity =
                  items.find(
                    (item) => item.type === "service" && item.id === service.id,
                  )?.qty || 0;
                return (
                  <article className={styles.serviceCard} key={service.id}>
                    <div className={styles.servicePhoto}>
                      <Image
                        src={`/images/styledesk/${photo.file}.webp`}
                        alt={photo.alt}
                        fill
                        sizes="(max-width:760px) 90vw, 33vw"
                      />
                      <span>{service.category}</span>
                    </div>
                    <div className={styles.serviceBody}>
                      <div className={styles.duration}>
                        <Clock3 size={13} />
                        {service.duration > 0
                          ? `${service.duration} min`
                          : "Duration confirmed when booking"}
                      </div>
                      <h3>{service.name}</h3>
                      <p>{serviceIntro(service.category)}</p>
                      <details className={styles.details}>
                        <summary>About this service</summary>
                        <p>
                          {service.description ||
                            "Ask our team for the details of this treatment before your visit."}
                        </p>
                      </details>
                      <div className={styles.cardBottom}>
                        <div>
                          <small>Service price</small>
                          <strong>{formatCurrency(service.price)}</strong>
                        </div>
                        <button
                          onClick={() =>
                            addItem({
                              type: "service",
                              id: service.id,
                              name: service.name,
                              price: Number(service.price),
                              imageUrl: `/images/styledesk/${photo.file}.webp`,
                            })
                          }
                          aria-label={`Add ${service.name} to booking bag`}
                        >
                          <Plus size={15} />
                          {quantity
                            ? `Add another (${quantity})`
                            : "Add to bag"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {status === "ready" && filtered.length > 0 && (
            <div className={styles.bagPrompt}>
              <span>
                <Check size={16} /> Found your favorites? Your booking bag keeps
                them together.
              </span>
              <button onClick={openCart}>
                Review my bag <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <section className={styles.grooming}>
          <div className={styles.groomingPhoto}>
            <Image
              src="/images/styledesk/barber.webp"
              alt="Barber shaping a fresh haircut"
              fill
              sizes="(max-width:760px) 90vw, 40vw"
            />
          </div>
          <div>
            <p className={styles.eyebrow}>
              A LITTLE SHARPER. A LITTLE MORE YOU.
            </p>
            <h2>
              Good grooming.
              <br />
              <span>Great energy.</span>
            </h2>
            <p>
              From a clean-cut refresh to the finishing touches on your beard,
              make your next visit part of your routine.
            </p>
            <a
              className={styles.textLink}
              href="#service-menu"
              onClick={() => {
                setActive("Barber");
                setSearch("");
              }}
            >
              Explore barbering <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <section className={styles.help}>
          <div>
            <p className={styles.eyebrow}>NOT SURE WHERE TO START?</p>
            <h2>
              Let’s find <span>your thing.</span>
            </h2>
            <p>
              Tell us what you have in mind. We’ll help you choose the right
              care for your next visit.
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
