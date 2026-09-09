/**
 * Enrollment PIN / device UID allocation.
 *
 * Contract (must never be broken):
 * - Next UID = smallest unused integer starting at 1 (fill gaps first)
 * - If 1..max are all taken, next = max + 1
 * - Never renumber, reorder, or overwrite an existing employee's UID
 * - DB fingerprintCode and ZKTeco device PIN must stay identical for a link
 */

export const MAX_ENROLL_PIN = 9_999;

export function parseEnrollPin(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_ENROLL_PIN) return null;
  return n;
}

/**
 * Returns the lowest available enrollment PIN as a string.
 *
 * Examples:
 *   used {5..14} → "1"
 *   used {1..5}  → "6"
 *   used {}      → "1"  (blank device only)
 */
export function computeNextEnrollPin(usedPins: Iterable<number>): string {
  const used = new Set<number>();
  for (const raw of usedPins) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_ENROLL_PIN) continue;
    used.add(n);
  }

  for (let candidate = 1; candidate <= MAX_ENROLL_PIN; candidate++) {
    if (!used.has(candidate)) {
      return String(candidate);
    }
  }

  throw new Error(
    'No free fingerprint PIN available (1–9999 are all in use). Remove an unused device user and try again.',
  );
}
