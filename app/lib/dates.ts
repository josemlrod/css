const BOOKING_TIME_ZONE = 'America/New_York';

// Bookers can book up to this many days ahead. Pending the operator's answer in #58.
export const MAX_BOOKING_WINDOW_DAYS = 90;

// How long before a tour starts that booking closes. Set once #58 picks a value.
export const BOOKING_LEAD_TIME_MS = 0;

export function getTodayInBookingTimeZone(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getLastBookableDate() {
  const lastDate = new Date(`${getTodayInBookingTimeZone()}T00:00:00.000Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() + MAX_BOOKING_WINDOW_DAYS);

  return lastDate.toISOString().slice(0, 10);
}

export function isDateOnOrAfterToday(date: string) {
  return date >= getTodayInBookingTimeZone();
}

export function isDateWithinBookingWindow(date: string) {
  return date <= getLastBookableDate();
}

export const DATE_UNAVAILABLE_MESSAGE =
  'Tours are not running on this date. Please choose another date.';

export function isDateBlocked(tour: { blockedDates?: string[] }, date: string) {
  return tour.blockedDates?.includes(date) ?? false;
}

function getBookingTimeZoneOffset(timestamp: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BOOKING_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(timestamp)
      .map(({ type, value }) => [type, Number(value)]),
  );

  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
    Math.floor(timestamp / 60_000) * 60_000
  );
}

// Turns a tour date and start time ("2026-09-25", "9:00 AM") into a timestamp
// in the booking time zone, regardless of the server's TZ.
export function getTourStartAt(date: string, time: string) {
  const match = /^(\d{1,2}):(\d{2}) ([AP]M)$/.exec(time);
  if (!match) return NaN;

  const [year, month, day] = date.split('-').map(Number);
  const hours = (Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0);
  const wallClock = Date.UTC(year, month - 1, day, hours, Number(match[2]));
  const guess = wallClock - getBookingTimeZoneOffset(wallClock);

  return wallClock - getBookingTimeZoneOffset(guess);
}

export function isTourStartBookable(
  date: string,
  time: string,
  now = Date.now(),
) {
  return getTourStartAt(date, time) - BOOKING_LEAD_TIME_MS > now;
}
