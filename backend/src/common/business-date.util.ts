const BUSINESS_TIME_ZONE = 'Asia/Dhaka';

/** Calendar month/year "today" in Asia/Dhaka — never server-local time (which may be UTC). */
export function getBusinessMonthYear(): { month: number; year: number } {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month] = today.split('-').map(Number);
  return { month, year };
}
