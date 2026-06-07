import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../convex/_generated/api';
import { tryCatch } from './utils';
import type { BookingId, NormalizedBooking } from './types';
import type { Id } from '../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export async function getBooking(bookingId: BookingId) {
  const [booking, err] = await tryCatch(
    convex.query(api.bookings.getBookingById, { bookingId }),
  );

  if (err) throw new Error('Something went wrong');

  return booking;
}

export async function getBookingWithTour(bookingId: BookingId) {
  const [res, err] = await tryCatch(
    convex.query(api.bookings.getBookingWithTour, { bookingId }),
  );

  if (err) throw new Error('Something went wrong');

  return res;
}

export async function getBookingWithTourForAccess(
  bookingId: BookingId,
  accessTokenHash: string,
) {
  const [res, err] = await tryCatch(
    convex.query(api.bookings.getBookingWithTourForAccess, {
      bookingId,
      accessTokenHash,
    }),
  );

  if (err) throw new Error('Something went wrong');

  return res;
}

export async function saveBooking(booking: NormalizedBooking) {
  const bookingId = await convex.mutation(api.bookings.createBooking, booking);
  return bookingId;
}

export async function updateBooking(
  updates: Partial<NormalizedBooking> & { id: Id<'bookings'> },
) {
  const bookingId = await convex.mutation(api.bookings.updateBooking, updates);
  return bookingId;
}

export async function cancelPaidBooking(input: {
  id: Id<'bookings'>;
  accessTokenHash: string;
  stripeRefundId: string;
}) {
  const bookingId = await convex.mutation(api.bookings.cancelPaidBooking, input);
  return bookingId;
}
