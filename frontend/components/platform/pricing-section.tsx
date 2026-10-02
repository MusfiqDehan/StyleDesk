"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Crown, Layers, ShieldCheck, Sparkles, Sprout, Users, UserRound } from "lucide-react";

export type PublicPackage = {
  id: string;
  slug?: string;
  name: string;
  currency: string;
  monthly: number | string;
  yearly: number | string;
  staff_limit: number;
  customer_limit: number;
  trial_days: number;
  features: string[];
  demo?: boolean;
};

const capabilities = [
  ["appointments", "Appointment scheduling"],
  ["pos", "Point of sale & checkout"],
  ["invoice", "Invoices & payment tracking"],
  ["inventory", "Inventory management"],
  ["finance", "Income & expense tracking"],
  ["reports", "Business reports"],
  ["online-payments", "Online customer payments"],
  ["branches", "Multiple branches"],
  ["hr-payroll", "Attendance & payroll"],
  ["domains", "Your own custom domain"],
];
const planStyles = {
  starter: { Icon: Sprout, tagline: "A strong start", description: "Bring your daily essentials into one happy place." },
  growth: { Icon: Sparkles, tagline: "Your next chapter", description: "Make more room for your team and your ambitions." },
  pro: { Icon: Crown, tagline: "The bigger picture", description: "Connect the people, places, and details of your business." },
};

export function PricingSection({ packages, loading, error }: { packages: PublicPackage[]; loading: boolean; error: string }) {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="platform-section pricing-section" aria-labelledby="pricing-title">
      <div className="pricing-intro">
        <span className="pricing-kicker"><Sparkles size={14} aria-hidden="true" /> A PLAN FOR EVERY CHAPTER</span>
        <h2 id="pricing-title">Space to start.<br /><span>Room to grow.</span></h2>
        <p>Your craft deserves a clear desk. Choose the workspace that fits your business today.</p>
        <div className="pricing-billing" role="group" aria-label="Billing interval">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly <span>Annual billing</span></button>
        </div>
      </div>
      {loading && <div className="pricing-loading" role="status"><Layers size={22} /> Finding your next chapter…</div>}
      {error && <p className="platform-error" role="alert">Pricing is currently unavailable. Please try again shortly.</p>}
      {!loading && !error && packages.length === 0 && <p className="pricing-empty">New packages are on their way. Check back soon.</p>}
      <div className="pricing-plans" aria-live="polite" aria-busy={loading}>
        {packages.map((plan, index) => {
          const key = (plan.slug ?? plan.name).toLowerCase();
          const identity = planStyles[key as keyof typeof planStyles] ?? { Icon: Layers, tagline: "Your own workspace", description: "A dedicated home for your team, bookings, and business." };
          const featured = key === "growth";
          const amount = Number(yearly ? plan.yearly : plan.monthly);
          const annualSavings = Number(plan.monthly) * 12 - Number(plan.yearly);
          const percentSaved = Number(plan.monthly) > 0 ? Math.round(annualSavings / (Number(plan.monthly) * 12) * 1000) / 10 : 0;
          const format = (value: number) => new Intl.NumberFormat("en-BD", { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
          const Icon = identity.Icon;
          return (
            <article className={`pricing-plan ${featured ? "pricing-plan-featured" : ""}`} key={plan.id} aria-labelledby={`plan-${plan.id}`}>
              <div className="pricing-plan-top"><span className="pricing-plan-icon"><Icon size={23} aria-hidden="true" /></span><span className="pricing-plan-chapter">{String(index + 1).padStart(2, "0")} / {identity.tagline}</span></div>
              <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
              <p className="pricing-plan-description">{identity.description}</p>
              <div className="pricing-amount"><span className="pricing-currency">{plan.currency}</span><strong>{format(amount)}</strong><span className="pricing-period">/ {yearly ? "year" : "month"}</span></div>
              <div className="pricing-billing-note">{yearly ? <>≈ {plan.currency} {format(Number(plan.yearly) / 12)} per month, billed yearly</> : "Billed monthly, one chapter at a time."}</div>
              <div className="pricing-plan-perk">{yearly && annualSavings > 0 ? <span className="pricing-save">Save {percentSaved}% · {plan.currency} {format(annualSavings)} a year</span> : plan.trial_days > 0 ? <span className="pricing-trial">{plan.trial_days}-day trial to find your rhythm</span> : <span className="pricing-trial">{identity.tagline}, on your terms</span>}</div>
              <Link className="pricing-plan-cta" href={`/register?package=${plan.id}&interval=${yearly ? "yearly" : "monthly"}`}>{plan.trial_days > 0 ? "Try " + plan.name : "Choose " + plan.name}<ArrowUpRight size={18} aria-hidden="true" /></Link>
              <div className="pricing-capacity"><div><Users size={16} aria-hidden="true" /><strong>{plan.staff_limit.toLocaleString()}</strong><span>staff accounts</span></div><div><UserRound size={16} aria-hidden="true" /><strong>{plan.customer_limit.toLocaleString()}</strong><span>customer accounts</span></div></div>
              <p className="pricing-includes">YOUR WORKSPACE INCLUDES</p>
              <ul className="pricing-feature-list">{capabilities.filter(([feature]) => plan.features.includes(feature)).map(([feature, label]) => <li key={feature}><Check size={15} aria-hidden="true" /><span>{label}</span></li>)}</ul>
              <a className="pricing-compare-link" href="#plan-comparison">Explore every included feature <ArrowUpRight size={13} aria-hidden="true" /></a>
              {plan.demo && <small className="pricing-demo-note">Demo package</small>}
            </article>
          );
        })}
      </div>
      {packages.length > 0 && <div className="pricing-shared"><span><ShieldCheck size={16} aria-hidden="true" /> Your own private workspace</span><span><Check size={16} aria-hidden="true" /> Role-based team access</span><span><Check size={16} aria-hidden="true" /> Your business, your brand</span></div>}
      <p className="pricing-payment-note">Stripe subscriptions renew automatically. SSLCommerz renewals use a new checkout each period.</p>
    </section>
  );
}
