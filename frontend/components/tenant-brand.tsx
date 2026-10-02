"use client";
import Link from "next/link";
import { useBusiness } from "@/context/BusinessContext";
import { resolveLogoUrl } from "@/lib/business-branding";
import styles from "./brand-logo.module.css";
export function TenantBrand({ variant = "default", className = "" }: { variant?: "default" | "sidebar" | "mark"; className?: string }) {
  const { businessInfo, businessName } = useBusiness();
  return <Link href="/" data-slot="tenant-brand" data-variant={variant} title={businessName} className={`${styles.brand} ${variant === "sidebar" ? styles.sidebar : variant === "mark" ? styles.markOnly : ""} ${className}`} aria-label={`${businessName} — home`}>
    {businessInfo?.logoUrl ? <img className={styles.mark} src={resolveLogoUrl(businessInfo.logoUrl)} alt="" style={{objectFit: "contain"}} /> : <span className={`${styles.mark} tenant-initial`} aria-hidden="true">{businessName.slice(0,1).toUpperCase()}</span>}
    {variant !== "mark" && <span className={styles.wordmark}><strong>{businessName}</strong><span>Hair · beauty · grooming</span></span>}
  </Link>;
}
