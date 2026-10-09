const BOOKING_TIME_ZONE = 'America/New_York';

// Bookers can book up to this many days ahead. Pending the operator's answer in #58.
export const MAX_BOOKING_WINDOW_DAYS = 90;

export function getTodayInBookingTimeZone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
