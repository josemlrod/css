const BOOKING_TIME_ZONE = 'America/New_York';

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

export function isDateOnOrAfterToday(date: string) {
  return date >= getTodayInBookingTimeZone();
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
