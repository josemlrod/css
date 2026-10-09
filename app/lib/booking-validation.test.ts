import { describe, expect, it } from 'vitest';

import { BookingValidation } from '~/lib/booking-validation';
import { getLastBookableDate, getTodayInBookingTimeZone } from '~/lib/dates';

const validBooking = {
  date: getTodayInBookingTimeZone(),
  time: '11:30 AM',
  guests: 2,
  bookerName: 'Ada Lovelace',
  bookerEmail: 'ada@example.com',
};

describe('BookingValidation', () => {
  it('accepts valid booking details', () => {
    expect(BookingValidation.safeParse(validBooking).success).toBe(true);
    expect(
      BookingValidation.safeParse({ ...validBooking, date: getLastBookableDate() })
        .success,
    ).toBe(true);
  });

  it.each([
    ['date', { date: '2000-01-01' }],
    ['date past the booking window', { date: '2999-01-01' }],
    ['malformed date', { date: 'not-a-date' }],
    ['impossible date', { date: '2026-99-99' }],
    ['time', { time: '' }],
    ['guests', { guests: 0 }],
    ['booker name', { bookerName: '   ' }],
    ['booker email', { bookerEmail: 'not-an-email' }],
  ])('rejects invalid %s', (_, override) => {
    expect(
      BookingValidation.safeParse({ ...validBooking, ...override }).success,
    ).toBe(false);
  });
});
