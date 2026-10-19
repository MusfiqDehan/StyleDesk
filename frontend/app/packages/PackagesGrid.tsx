"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatCurrency, getMediaUrl } from "@/lib/utils";
import {
  packagePhoto,
  type SalonPackage,
} from "@/lib/package-presentation";
import styles from "./packages.module.css";

export default function PackagesGrid({
  packages,
}: {
  packages: SalonPackage[];
}) {
  const { addItem, items } = useCart();

  return (
    <div className={styles.catalog}>
      {packages.map((pkg) => {
        const fallback = packagePhoto(pkg);
        const customImage = getMediaUrl(
          pkg.imageUrl || pkg.image || pkg.coverImage,
        );
        const imageSrc = customImage || `/images/styledesk/${fallback.file}.webp`;
        const quantity =
          items.find((item) => item.type === "package" && item.id === pkg.id)
            ?.qty || 0;
        const features = (pkg.features || []).slice(0, 4);

        return (
          <article className={styles.packageCard} key={pkg.id}>
            <div className={styles.packagePhoto}>
              <Image
                src={imageSrc}
                alt={pkg.title}
                fill
                sizes="(max-width:760px) 90vw, 33vw"
                unoptimized={Boolean(customImage)}
              />
              <span>{pkg.category || "Package"}</span>
              {pkg.popular ? <b className={styles.loved}>Most loved</b> : null}
            </div>
            <div className={styles.packageBody}>
              <h3>{pkg.title}</h3>
              <p>
                {pkg.description ||
                  "A bundled visit with the treatments you want, already put together."}
              </p>
              {features.length > 0 && (
                <ul className={styles.features}>
                  {features.map((feature) => (
                    <li key={feature}>
                      <Check size={13} />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              <Link className={styles.moreLink} href={`/packages/${pkg.id}`}>
                See what’s included <ArrowUpRight size={14} />
              </Link>
              <div className={styles.cardBottom}>
                <div>
                  <small>Package price</small>
                  <strong>{formatCurrency(pkg.price)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addItem({
                      type: "package",
                      id: pkg.id,
                      name: pkg.title,
                      price: Number(pkg.price) || 0,
                      imageUrl: imageSrc,
                    })
                  }
                  aria-label={`Add ${pkg.title} to booking bag`}
                >
                  <Plus size={15} />
                  {quantity ? `Add another (${quantity})` : "Add to bag"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
