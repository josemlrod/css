import { describe, expect, it } from 'vitest';

import {
  TourSettingsValidation,
  countActiveBookingsByDate,
  filterOperatorBookings,
  groupUpcomingClosedDates,
  parseBookingView,
  summarizeActivity,
  summarizeNextWeek,
  toTourStartTime,
  type OperatorBooking,
} from './operator';

const today = '2026-10-09';

function booking(id: string, overrides: Partial<OperatorBooking>) {
  return {
    _id: id,
    tourId: 'ghost',
    date: today,
    time: '9:00 PM',
    guests: 2,
    bookerName: 'Ana Delgado',
    bookerEmail: 'ana@example.com',
    cancelled: null,
    paymentStatus: 'paid',
    total: 64,
    ...overrides,
  } as OperatorBooking;
}

const bookings = [
  booking('late', { time: '10:30 PM' }),
  booking('early', { time: '7:30 PM', tourId: 'food' as never, bookerName: 'Wes Lin' }),
  booking('failed', { date: '2026-10-12', cancelled: 1, paymentStatus: 'refund_failed' }),
  booking('old', { date: '2026-10-01' }),
  booking('older', { date: '2026-09-20' }),
  booking('far', { date: '2026-10-30', total: 999 }),
];

const ids = (view: Parameters<typeof filterOperatorBookings>[1]) =>
  filterOperatorBookings(bookings, view, today).map((b) => b._id);
const none = { query: '', tourId: '', date: '' };

describe('operator booking views', () => {
  it('filters and sorts each view', () => {
    expect(ids({ view: 'upcoming', ...none })).toEqual(['early', 'late', 'far']);
    expect(ids({ view: 'attention', ...none })).toEqual(['failed']);
    expect(ids({ view: 'canceled', ...none })).toEqual(['failed']);
    expect(ids({ view: 'past', ...none })).toEqual(['old', 'older']);
    expect(ids({ view: 'upcoming', ...none, query: 'WES' })).toEqual(['early']);
    expect(ids({ view: 'upcoming', ...none, tourId: 'food' })).toEqual(['early']);
    expect(ids({ view: 'past', ...none, date: '2026-10-12' })).toEqual(['failed']);
    expect(parseBookingView('past')).toBe('past');
    expect(parseBookingView('nope')).toBe('upcoming');
  });

  it('summarizes the next 7 days and active Bookings per date', () => {
    expect(summarizeNextWeek(bookings, today)).toEqual({ bookings: 2, guests: 4, revenue: 128 });
    expect(countActiveBookingsByDate(bookings, today)).toEqual({
      [today]: { ghost: { bookings: 1, guests: 2 }, food: { bookings: 1, guests: 2 } },
      '2026-10-30': { ghost: { bookings: 1, guests: 2 } },
    });
  });
});

describe('operator recent activity', () => {
  it('marks activity after the last seen time as new and labels its age', () => {
    const now = Date.parse('2026-10-09T18:00:00Z');
    const event = (minutesAgo: number) => ({ at: now - minutesAgo * 60_000 }) as never;
    const { newCount, items } = summarizeActivity(
      [event(0), event(5), event(180), event(3000)],
      now - 60 * 60_000,
      now,
    );

    expect(newCount).toBe(2);
    expect(items.map(({ isNew, age }) => [isNew, age])).toEqual([
      [true, 'Just now'],
      [true, '5 min ago'],
      [false, '3 hr ago'],
      [false, 'Wed, Oct 7'],
    ]);
  });
});

describe('operator tour settings', () => {
  it('validates settings and sorts start times', () => {
    const settings = { price: '32', maxGuests: '20', meetingPoint: ' Reynolds Square ' };

    expect(
      TourSettingsValidation.parse({ ...settings, startTimes: ['9:00 PM', '7:30 PM'] }),
    ).toEqual({ price: 32, maxGuests: 20, meetingPoint: 'Reynolds Square', startTimes: ['7:30 PM', '9:00 PM'] });
    expect(TourSettingsValidation.safeParse({ ...settings, startTimes: [] }).success).toBe(false);
    expect(
      TourSettingsValidation.safeParse({ ...settings, startTimes: ['7:30 PM', '7:30 PM'] }).success,
    ).toBe(false);
    expect(TourSettingsValidation.safeParse({ ...settings, startTimes: ['19:30'] }).success).toBe(false);
    expect([toTourStartTime('00:05'), toTourStartTime('12:00'), toTourStartTime('19:30')]).toEqual([
      '12:05 AM',
      '12:00 PM',
      '7:30 PM',
    ]);
  });

  it('groups upcoming closed dates across tours', () => {
    expect(
      groupUpcomingClosedDates(
        [
          { _id: 'food', blockedDates: ['2026-11-26', '2026-10-19', '2026-01-01'] },
          { _id: 'ghost', blockedDates: ['2026-11-26'] },
          { _id: 'river' },
        ],
        today,
      ),
    ).toEqual([
      { date: '2026-10-19', tourIds: ['food'] },
      { date: '2026-11-26', tourIds: ['food', 'ghost'] },
    ]);
  });
});
