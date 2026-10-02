"use client";
import { useId, useState } from "react";

/** A keyboard-operable SVG appointment illustration, with a real selectable day. */
export function SalonArtwork() {
  const [day, setDay] = useState(1);
  const titleId = useId();
  return <div className="salon-artwork">
    <svg viewBox="0 0 440 280" role="img" aria-labelledby={titleId}>
      <title id={titleId}>A salon calendar, scissors and a growing business</title>
      <circle cx="220" cy="140" r="125" fill="var(--brand-soft)" />
      <g className="art-spark" fill="var(--brand-text)"><path d="M370 20l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" /><path d="M58 187l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" /></g>
      <g className="art-calendar"><rect x="100" y="50" width="240" height="180" rx="25" fill="var(--surface)" stroke="var(--brand-line)" strokeWidth="2" /><path d="M100 100h240" stroke="var(--brand-line)" strokeWidth="2" /><path d="M155 37v28m130-28v28" stroke="var(--brand-text)" strokeWidth="8" strokeLinecap="round" />
      {[0,1,2,3,4].map((n) => <g key={n}><rect x={120+n*42} y="121" width="33" height="36" rx="10" fill={day === n ? "var(--brand-primary)" : "var(--brand-soft)"} /><text x={136+n*42} y="145" textAnchor="middle" fontSize="15" fill={day === n ? "var(--brand-on-primary)" : "var(--brand-ink)"}>{12+n}</text></g>)}
      <rect x="122" y="175" width="150" height="9" rx="4" fill="var(--brand-soft)" /><rect x="122" y="196" width="110" height="9" rx="4" fill="var(--brand-soft)" /><circle cx="302" cy="189" r="17" fill="var(--brand-primary)" /><path d="m294 189 6 6 10-12" fill="none" stroke="var(--brand-on-primary)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="art-scissors" stroke="var(--brand-text)" fill="var(--surface)" strokeWidth="5" strokeLinecap="round"><circle cx="65" cy="90" r="14" /><circle cx="65" cy="130" r="14" /><path d="m76 99 53 45m-53-23 53-48" /><circle cx="91" cy="111" r="4" /></g>
      <g className="art-growth" fill="var(--brand-primary)"><rect x="348" y="205" width="14" height="25" rx="5" /><rect x="370" y="187" width="14" height="43" rx="5" /><rect x="392" y="166" width="14" height="64" rx="5" /></g>
    </svg>
    <div className="art-day-picker" role="group" aria-label="Try the appointment calendar">
      {[0,1,2,3,4].map(n => <button key={n} type="button" aria-pressed={day === n} onClick={() => setDay(n)}>{["Mon", "Tue", "Wed", "Thu", "Fri"][n]}</button>)}
    </div>
    <p aria-live="polite">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day]} selected · Make room for your next appointment.</p>
  </div>;
}
export function CraftArtwork() {
  return <svg className="craft-artwork" viewBox="0 0 200 130" role="img" aria-label="Salon scissors and a beauty mirror">
    <rect x="110" y="12" width="62" height="84" rx="31" fill="var(--brand-soft)" stroke="var(--brand-text)" strokeWidth="3" /><path d="M141 97v21m-23 0h46M126 35l25-10" stroke="var(--brand-text)" strokeWidth="3" strokeLinecap="round" />
    <g className="art-scissors" stroke="var(--brand-text)" strokeWidth="4" fill="none"><circle cx="37" cy="90" r="12" /><circle cx="67" cy="101" r="12" /><path d="m43 80 38-59m-19 68-19-68" /></g>
    <path className="art-spark" d="m93 17 4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="var(--brand-primary)" />
  </svg>;
}
