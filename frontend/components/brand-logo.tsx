import Image from "next/image";
import Link from "next/link";
import styles from "./brand-logo.module.css";

type BrandLogoVariant = "default" | "sidebar" | "mark";

/** StyleDesk ribbon and scissors mark, generated for the platform. */
export function BrandLogo({
  variant = "default",
  href = "/",
  className,
}: {
  variant?: BrandLogoVariant;
  href?: string;
  className?: string;
}) {
  const markOnly = variant === "mark";
  const variantClass =
    variant === "sidebar"
      ? styles.sidebar
      : variant === "mark"
        ? styles.markOnly
        : "";
  return (
    <Link
      href={href}
      className={`${styles.brand} ${variantClass} ${className ?? ""}`.trim()}
      aria-label="StyleDesk by MusfiqDehan — home"
    >
      <Image className={styles.mark} src="/brand/platform/styledesk-modern.png" width={45} height={45} alt="" />
      {!markOnly && (
        <span className={styles.wordmark}>
          <strong>StyleDesk</strong>
          <span>by MusfiqDehan</span>
        </span>
      )}
    </Link>
  );
}
