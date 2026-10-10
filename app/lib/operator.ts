import { z } from 'zod';

import type { FunctionReturnType } from 'convex/server';

import { BOOKING_TIME_ZONE } from './dates';

import type { api } from '../../convex/_generated/api';

export type OperatorBooking = FunctionReturnType<
  typeof api.bookings.listBookingsForOperator
>[number];

export type BookingActivity = FunctionReturnType<
  typeof api.bookings.listBookingActivity
>[number];

// Recent activity covers this long. Older Bookings and cancellations are never "new".
export const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_LIMIT = 6;

// The latest Bookings and cancellations, marking those after `seenAt` (when this
// browser last marked them seen) as new.
export function summarizeActivity(events: BookingActivity[], seenAt: number, now: number) {
  return {
    newCount: events.filter((event) => event.at > seenAt).length,
    items: events.slice(0, ACTIVITY_LIMIT).map((event) => ({
      ...event,
      isNew: event.at > seenAt,
      age: formatActivityAge(event.at, now),
    })),
  };
}

function formatActivityAge(at: number, now: number) {
  const minutes = Math.floor((now - at) / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hr ago`;

  return new Date(at).toLocaleDateString('en-US', {
    timeZone: BOOKING_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export const OPERATOR_BOOKING_VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'canceled', label: 'Canceled' },
  { id: 'past', label: 'Past' },
] as const;

export type OperatorBookingView = (typeof OPERATOR_BOOKING_VIEWS)[number]['id'];

export function parseBookingView(value: string | null): OperatorBookingView {
  return OPERATOR_BOOKING_VIEWS.some((view) => view.id === value)
    ? (value as OperatorBookingView)
    : 'upcoming';
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function timeToMinutes(time: string) {
  const [, hours, minutes, meridiem] = /^(\d{1,2}):(\d{2}) ([AP]M)$/.exec(time) ?? [];
  return ((Number(hours) % 12) + (meridiem === 'PM' ? 12 : 0)) * 60 + Number(minutes);
}

export function filterOperatorBookings(
  bookings: OperatorBooking[],
  filters: { view: OperatorBookingView; query: string; tourId: string; date: string },
  today: string,
) {
  const query = filters.query.trim().toLowerCase();

  return bookings
    .filter((booking) => {
      if (filters.tourId && booking.tourId !== filters.tourId) return false;
      if (
        query &&
        !`${booking.bookerName} ${booking.bookerEmail} ${booking._id}`
          .toLowerCase()
          .includes(query)
      )
        return false;
      // A date filter shows every Booking on that day, whatever the view.
      if (filters.date) return booking.date === filters.date;
      if (filters.view === 'upcoming') return !booking.cancelled && booking.date >= today;
      if (filters.view === 'attention') return booking.paymentStatus === 'refund_failed';
      if (filters.view === 'canceled') return Boolean(booking.cancelled);
      return booking.date < today;
    })
    .sort((a, b) => {
      const order =
        a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time);
      return filters.view === 'past' && !filters.date ? -order : order;
    });
}

export function summarizeNextWeek(bookings: OperatorBooking[], today: string) {
  const end = addDays(today, 7);
  const week = bookings.filter(
    (booking) => !booking.cancelled && booking.date >= today && booking.date < end,
  );

  return {
    bookings: week.length,
    guests: week.reduce((sum, booking) => sum + booking.guests, 0),
    revenue: week.reduce((sum, booking) => sum + booking.total, 0),
  };
}

const START_TIME = /^(1[0-2]|[1-9]):[0-5]\d [AP]M$/;

export const TourSettingsValidation = z.object({
  price: z.coerce.number().positive().max(10_000),
  maxGuests: z.coerce.number().int().min(1).max(500),
  startTimes: z
    .array(z.string().regex(START_TIME))
    .min(1)
    .refine((times) => new Set(times).size === times.length)
    .transform((times) =>
      [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
    ),
  meetingPoint: z.string().trim().min(1).max(200),
});

export const BlockedDateValidation = z.object({
  date: z.iso.date(),
  tourIds: z.array(z.string().min(1)).min(1),
  blocked: z.boolean(),
});

// "14:30" from <input type="time"> → "2:30 PM", the format tours store.
export function toTourStartTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function groupUpcomingClosedDates(
  tours: { _id: string; blockedDates?: string[] }[],
  today: string,
) {
  const byDate = new Map<string, string[]>();

  for (const tour of tours) {
    for (const date of tour.blockedDates ?? []) {
      if (date >= today) byDate.set(date, [...(byDate.get(date) ?? []), tour._id]);
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tourIds]) => ({ date, tourIds }));
}

// Active Booking counts per date and tour, so closing a date can warn about Bookers already booked.
export function countActiveBookingsByDate(bookings: OperatorBooking[], today: string) {
  const counts: Record<string, Record<string, { bookings: number; guests: number }>> = {};

  for (const booking of bookings) {
    if (booking.cancelled || booking.date < today) continue;
    const day = (counts[booking.date] ??= {});
    const count = (day[booking.tourId] ??= { bookings: 0, guests: 0 });
    count.bookings += 1;
    count.guests += booking.guests;
  }

  return counts;
}
