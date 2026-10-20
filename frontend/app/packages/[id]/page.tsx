"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Gift,
  Plus,
  Sparkles,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-chrome";
import { useCart } from "@/context/CartContext";
import { formatCurrency, getMediaUrl } from "@/lib/utils";
import {
  packagePhoto,
  type SalonPackage,
} from "@/lib/package-presentation";
import styles from "../packages.module.css";

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addItem, items } = useCart();
  const [pkg, setPkg] = useState<SalonPackage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `${"/api/backend"}/makeover-packages/${id}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) {
          setStatus("missing");
          return;
        }
        setPkg(await response.json());
        setStatus("ready");
      } catch {
        setStatus("missing");
      }
    }
    void load();
    return () => controller.abort();
  }, [id]);

  if (status === "loading") {
    return (
      <div className={styles.page}>
        <PublicHeader />
        <main>
          <div className={styles.detail}>
            <div className={styles.loading} role="status">
              <Sparkles size={28} />
              <p>Finding this package for you…</p>
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (status === "missing" || !pkg) {
    return (
      <div className={styles.page}>
        <PublicHeader />
        <main>
          <div className={styles.detail}>
            <div className={styles.empty}>
              <span>
                <Gift size={28} />
              </span>
              <h3>We couldn’t find that package.</h3>
              <p>
                It may have been updated. Explore the full menu and pick a
                ritual that feels right.
              </p>
              <Link className={styles.primaryButton} href="/packages">
                Back to packages <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const fallback = packagePhoto(pkg);
  const customImage = getMediaUrl(pkg.imageUrl || pkg.image || pkg.coverImage);
  const imageSrc = customImage || `/images/styledesk/${fallback.file}.webp`;
  const quantity =
    items.find((item) => item.type === "package" && item.id === pkg.id)?.qty ||
    0;
  const features = pkg.features || [];

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#package-details">
        Skip to package details
      </a>
      <PublicHeader />
      <main>
        <section className={styles.detail} id="package-details">
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/packages">Packages</Link>
            <span>/</span>
            <span aria-current="page">{pkg.title}</span>
          </nav>
          <div className={styles.detailLayout}>
            <div className={styles.detailPhoto}>
              <Image
                src={imageSrc}
                alt={pkg.title}
                fill
                priority
                sizes="(max-width:760px) 90vw, 45vw"
                unoptimized={Boolean(customImage)}
              />
            </div>
            <div className={styles.detailCopy}>
              <p className={styles.pill}>
                <Gift size={13} /> {pkg.category || "PACKAGE"}
              </p>
              <h1>
                {pkg.title}
                {pkg.popular ? <span> Most loved.</span> : null}
              </h1>
              {pkg.billingCycle ? (
                <div className={styles.cycle}>
                  <Clock3 size={14} />
                  {pkg.billingCycle}
                </div>
              ) : null}
              <p>
                {pkg.description ||
                  "A bundled visit with the treatments you want, already put together for an easier, feel-good appointment."}
              </p>
              {features.length > 0 && (
                <ul className={styles.features}>
                  {features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.detailActions}>
                <div className={styles.priceBlock}>
                  <small>Package price</small>
                  <strong>{formatCurrency(pkg.price)}</strong>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() =>
                    addItem({
                      type: "package",
                      id: pkg.id,
                      name: pkg.title,
                      price: Number(pkg.price) || 0,
                      imageUrl: imageSrc,
                    })
                  }
                >
                  <Plus size={16} />
                  {quantity ? `Add another (${quantity})` : "Add to bag"}
                </button>
              </div>
              <Link className={styles.textLink} href="/packages">
                See all packages <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <section className={styles.help}>
          <div>
            <p className={styles.eyebrow}>NOT QUITE IT?</p>
            <h2>
              We’ll shape <span>something closer.</span>
            </h2>
            <p>
              Tell us what you had in mind and we’ll help you choose services
              or a package that feels like the right fit.
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
