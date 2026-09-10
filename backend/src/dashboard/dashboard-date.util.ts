/** Business calendar for StyleDesk (Bangladesh). */
export const BUSINESS_TIME_ZONE = 'Asia/Dhaka';
export const BUSINESS_TIME_OFFSET_HOURS = 6;

/** YYYY-MM-DD in Asia/Dhaka (not server local/UTC). */
export function toBusinessDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function businessDayBounds(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startUtc =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
    BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
  const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1;
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

export function shiftBusinessDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const noonUtc =
    Date.UTC(year, month - 1, day, 12, 0, 0, 0) -
    BUSINESS_TIME_OFFSET_HOURS * 60 * 60 * 1000;
  return toBusinessDateStr(new Date(noonUtc + days * 86400000));
}

export function businessWeekdayShort(dateStr: string): string {
  const { start } = businessDayBounds(dateStr);
  return start.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function businessMonthShort(dateStr: string): string {
  const { start } = businessDayBounds(dateStr);
  return start.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function monthBounds(
  year: number,
  month: number,
): { startStr: string; endStr: string; start: Date; end: Date } {
  const startStr = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endStr = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  const { start } = businessDayBounds(startStr);
  const { end } = businessDayBounds(endStr);
  return { startStr, endStr, start, end };
}
