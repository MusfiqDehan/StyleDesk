"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, History, LogOut, Menu, Settings, X } from "lucide-react";
import { TenantBrand as BrandLogo } from "@/components/tenant-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBusiness } from "@/context/BusinessContext";
import { useCart } from "@/context/CartContext";
import { signOut } from "@/lib/auth-redirect";
import styles from "@/app/components/salon-landing.module.css";

function readUserFromToken() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      name: decoded.clientName || decoded.employeeName || decoded.name || decoded.useremail,
      role: decoded.role as string | undefined,
    };
  } catch {
    return null;
  }
}

export function PublicHeader() {
  const pathname = usePathname();
  const { openCart, itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const links = [
    { href: "/services", label: "Services" },
    { href: "/packages", label: "Packages" },
    { href: "/our-team", label: "Our people" },
    { href: "/about-us", label: "About us" },
  ];

  useEffect(() => {
    setUser(readUserFromToken());
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleLogout = () => signOut("/");

  const isCustomer = !user?.role || user.role === "customer";

  return (
    <>
      <header className={styles.header}>
        <BrandLogo />
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <button
            className={styles.bagButton}
            onClick={openCart}
            aria-label={`Open booking bag, ${itemCount} items`}
          >
            <CalendarDays size={17} />
            <span>My bag</span>
            <b>{itemCount}</b>
          </button>
          {user ? (
            <div ref={accountRef} className={styles.accountWrap}>
              <button
                type="button"
                className={styles.signIn}
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {user.name?.split(" ")[0] || "Account"}
              </button>
              {accountOpen && (
                <div className={styles.accountMenu} role="menu">
                  {isCustomer ? (
                    <>
                      <Link href="/customer-dashboard" onClick={() => setAccountOpen(false)}>
                        <History size={14} /> My appointments
                      </Link>
                      <Link href="/account-settings" onClick={() => setAccountOpen(false)}>
                        <Settings size={14} /> Account settings
                      </Link>
                    </>
                  ) : (
                    <Link href="/admin" onClick={() => setAccountOpen(false)}>
                      Dashboard
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className={styles.signIn}>
              Sign in <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className={styles.menuButton}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav
          id="public-mobile-navigation"
          className={styles.mobileNav}
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "page"
                  : undefined
              }
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              {isCustomer ? (
                <>
                  <Link href="/customer-dashboard" onClick={() => setMenuOpen(false)}>
                    My appointments
                  </Link>
                  <Link href="/account-settings" onClick={() => setMenuOpen(false)}>
                    Account settings
                  </Link>
                </>
              ) : (
                <Link href="/admin" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
              )}
              <button type="button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      )}
    </>
  );
}

export function PublicFooter() {
  const { businessName } = useBusiness();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div>
          <BrandLogo />
          <p>A little care. A lot of confidence.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/services">Services</Link>
          <Link href="/packages">Packages</Link>
          <Link href="/our-team">Our people</Link>
          <Link href="/about-us">About us</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/customer-dashboard">
            My appointments <ArrowUpRight size={13} />
          </Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} {businessName}</span>
        <span>HAIR · BEAUTY · BARBERING</span>
        <a
          href="/images/styledesk/credits.txt"
          target="_blank"
          rel="noreferrer"
        >
          Photography credits
        </a>
      </div>
    </footer>
  );
}
