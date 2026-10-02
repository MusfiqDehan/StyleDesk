"use client";
import { Table } from "@/components/ui/table"
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalonArtwork, CraftArtwork } from "./salon-artwork";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CalendarDays,
  ShieldCheck,
  Globe,
  BarChart3,
  Users,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { PricingSection, type PublicPackage } from "./pricing-section";
import { consoleApi } from "@/lib/console-api";
import { IntroVideo } from "./intro-video";
import "./platform.css";
export function PlatformBrand() {
  return <BrandLogo />;
}

export function PlatformLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.platform-header-shell')) setMenuOpen(false);
    };
    const resize = () => { if (window.innerWidth > 760) setMenuOpen(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [menuOpen]);
  const [packages, setPackages] = useState<PublicPackage[]>([]),
    [loadingPackages, setLoadingPackages] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    consoleApi("/platform/packages/public")
      .then(setPackages)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPackages(false));
  }, []);
  return (
    <main id="main" className="platform-app platform-landing">
      <a className="platform-skip" href="#features">Skip to content</a>
      <div className={'platform-header-shell' + (scrolled ? ' is-scrolled' : '')}>
        <header className="platform-top">
          <PlatformBrand />
          <nav className="platform-links platform-desktop-links" aria-label="Main navigation">
            <a className="optional" href="#features">
              Features
            </a>
            <a className="optional" href="#pricing">
              Pricing
            </a>
            <Link href="/login">Sign in</Link>
            <Link className="platform-btn primary" href="/register">
              Get started <ArrowRight size={15} />
            </Link>
          </nav>
          <div className="platform-header-controls">
            <ThemeToggle />
            <button ref={menuButton} type="button" className="platform-landing-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="platform-mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
          </div>
        </header>
        {menuOpen && <nav ref={menu} id="platform-mobile-navigation" className="platform-mobile-links" aria-label="Mobile navigation" onClick={event => { if ((event.target as HTMLElement).closest('a')) setMenuOpen(false); }}>
          <a href="#features">Explore features <ArrowRight size={16}/></a>
          <a href="#pricing">Packages & pricing <ArrowRight size={16}/></a>
          <Link href="/login">Sign in <ArrowRight size={16}/></Link>
          <Link className="platform-btn primary" href="/register">Get started <ArrowRight size={16}/></Link>
        </nav>}
      </div>
      <div className="platform-wrap">
        <section className="platform-hero">
          <div>
            <span className="platform-eyebrow">
              A calmer way to run your salon
            </span>
            <h1>
              A little clarity.
              <br />A fresh chapter.
              <br /><span>Your salon, in sync.</span>
            </h1>
            <p className="platform-lead">
              Bookings, your team, payments, and your salon’s own website. Bring
              your daily work together in one thoughtfully designed workspace.
            </p>
            <div className="platform-actions">
              <Link className="platform-btn primary" href="/register">
                Start your Starter trial <ArrowRight size={17} />
              </Link>
              <a className="platform-btn" href="#pricing">
                Explore packages
              </a>
            </div>
            <IntroVideo />
            <p className="platform-muted" style={{ marginTop: 20 }}>
              Email verification required · No card needed for Starter trial
            </p>
          </div>
          <div className="platform-collage">
          <SalonArtwork />
          <div
            className="platform-preview"
            aria-label="Illustrative product preview"
          >
            <div className="platform-preview-top">
              <strong>YOUR SALON / OVERVIEW</strong>
              <span className="platform-badge">Product preview</span>
            </div>
            <div className="platform-preview-grid">
              <div>
                <span className="platform-muted">Today’s appointments</span>
                <strong>12</strong>
                <span className="platform-muted">A clear view of your day</span>
              </div>
              <div>
                <span className="platform-muted">Your team</span>
                <strong>5</strong>
                <span className="platform-muted">Everyone in sync</span>
              </div>
            </div>
            <h3 style={{ fontSize: 14 }}>One workspace. Every detail.</h3>
            {[
              ["BK", "Bookings", "Schedule with confidence"],
              ["TM", "Team management", "Roles that fit your people"],
            ].map(([initial, title, sub]) => (
              <div className="platform-preview-row" key={title}>
                <span className="avatar">{initial}</span>
                <div>
                  <strong>{title}</strong>
                  <div className="platform-muted">{sub}</div>
                </div>
                <Check
                  size={16}
                  style={{ marginLeft: "auto", color: "var(--brand-text)" }}
                />
              </div>
            ))}

          </div>
          </div>
        </section>
        <div className="platform-trust"><span>BOOKINGS</span><span>YOUR PEOPLE</span><span>PAYMENTS</span><span>YOUR BRAND</span></div>
        <section id="features" className="platform-section">
          <span className="platform-eyebrow">
            Designed around your everyday
          </span>
          <h2>
            Less juggling.
            <br />
            More room to grow.
          </h2>
          <p className="platform-lead">
            Choose the capabilities your business needs today, and expand when
            you’re ready.
          </p>
          <div className="platform-grid" style={{ marginTop: 32 }}>
            {[
              [
                CalendarDays,
                "Bookings, made simple",
                "Keep appointments and customer details together.",
              ],
              [
                Users,
                "A team that stays aligned",
                "Invite your people and give each role the access it needs.",
              ],
              [
                Wallet,
                "Payments with clarity",
                "Track invoices, collect payments, and see what is outstanding.",
              ],
              [
                Globe,
                "Your salon, online",
                "Present your brand with a dedicated website and supported custom domains.",
              ],
              [
                BarChart3,
                "Understand your business",
                "Follow your performance with practical dashboards and reports.",
              ],
              [
                ShieldCheck,
                "A space of your own",
                "Your business data stays isolated, with access controlled at every level.",
              ],
            ].map(([Icon, title, description]: any) => (
              <article className="platform-card" key={title}>
                <span className="icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="platform-workflow">
          <CraftArtwork />
          <div><span className="platform-eyebrow">Your craft. Your company.</span><h2>A space that feels like you.</h2><p className="platform-lead">Add your company name and logo in settings. Welcome clients to your own salon website, and give your team one place to manage the day.</p><Link className="platform-btn primary" href="/register">Create your workspace <ArrowRight size={17} /></Link></div>
        </section>
        <PricingSection packages={packages} loading={loadingPackages} error={error} />
        {packages.length > 0 && (
          <section id="plan-comparison" className="platform-section pricing-comparison" aria-label="Package comparison">
            <span className="platform-eyebrow">Find your fit</span>
            <h2>A clear view of every package.</h2>
            <div className="platform-table-wrap">
              <Table pagination={false} className="platform-table">
                <thead>
                  <tr>
                    <th>Included capability</th>
                    {packages.map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["appointments", "Bookings"],
                    ["clients", "Client records"],
                    ["pos", "Point of sale"],
                    ["invoice", "Invoices"],
                    ["inventory", "Inventory"],
                    ["finance", "Finance & vouchers"],
                    ["reports", "Reports"],
                    ["branches", "Multiple branches"],
                    ["website.testimonials", "Website customization"],
                    ["online-payments", "Online customer payments"],
                    ["attendance", "Attendance & biometrics"],
                    ["hr-payroll", "Payroll"],
                    ["news-letter-subscriber", "Newsletter tools"],
                    ["domains", "Custom domains"],
                  ].map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {packages.map((p) => (
                        <td key={p.id}>
                          {p.features.includes(key) ? (
                            <span aria-label="Included">✓</span>
                          ) : (
                            <span aria-label="Not included">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        )}
        <section className="platform-section platform-faq">
          <span className="platform-eyebrow">Good to know</span>
          <h2>A few helpful answers.</h2>
          {[
            [
              "How do I start?",
              "Choose a package, create your business, and activate the link in your email. Starter begins with a trial; paid packages also require confirmed payment.",
            ],
            [
              "Does my salon get its own website?",
              "Your business gets its own platform subdomain. Website availability follows your package and platform feature settings.",
            ],
            [
              "Can I use my own domain?",
              "Eligible packages can connect a domain. Add the displayed DNS records; StyleDesk verifies ownership and automatically prepares routing and HTTPS.",
            ],
            [
              "Can my staff register themselves?",
              "Staff and platform accounts are invitation-only. Salon customers can register within the salon’s customer account limit.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="platform-final-cta"><span className="platform-eyebrow">Make room for what you love</span><h2>Good days start with a clear desk.</h2><p>Bring your bookings, people, and business together.</p><Link className="platform-btn primary" href="/register">Get started with StyleDesk <ArrowRight size={17} /></Link></section>
        <footer className="platform-footer">
          <PlatformBrand />
          <span>© {new Date().getFullYear()} StyleDesk by MusfiqDehan</span>
          <Link href="/login">Platform sign in</Link>
        </footer>
      </div>
    </main>
  );
}
