import { describe, expect, it } from 'vitest';

import { BookingValidation } from '~/lib/booking-validation';
import { getTodayInBookingTimeZone } from '~/lib/dates';

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
  });

  it.each([
    ['date', { date: '2000-01-01' }],
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
