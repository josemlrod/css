import { api } from '../../convex/_generated/api';
import { convexMutation, convexQuery } from './convex.server';
import { tryCatch } from './utils';
import type { BookingId } from './types';
import type { Id } from '../../convex/_generated/dataModel';

export async function getBookingWithTourForAccess(
  bookingId: BookingId,
  accessTokenHash: string,
) {
  const [res, err] = await tryCatch(
    convexQuery(api.bookings.getBookingWithTourForAccess, {
      bookingId,
      accessTokenHash,
    }),
  );

  if (err) throw new Error('Something went wrong');

  return res;
}

export async function cancelPaidBooking(input: {
  id: Id<'bookings'>;
  accessTokenHash: string;
  paypalRefundId: string;
}) {
  const bookingId = await convexMutation(api.bookings.cancelPaidBooking, input);
  return bookingId;
}
