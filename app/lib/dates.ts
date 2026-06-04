const BOOKING_TIME_ZONE = 'America/New_York';

export function getTodayInBookingTimeZone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isDateOnOrAfterToday(date: string) {
  return date >= getTodayInBookingTimeZone();
}
