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

export async function listBookingsForOperator() {
  const [bookings, err] = await tryCatch(
    convexQuery(api.bookings.listBookingsForOperator, {}),
  );

  if (err) throw new Error('Something went wrong');

  return bookings;
}

export async function getBookingForOperator(bookingId: string) {
  const [res, err] = await tryCatch(
    convexQuery(api.bookings.getBookingForOperator, { bookingId }),
  );

  if (err) throw new Error('Something went wrong');

  return res;
}

export async function countRefundFailedBookings() {
  const [count, err] = await tryCatch(
    convexQuery(api.bookings.countRefundFailedBookings, {}),
  );

  if (err) throw new Error('Something went wrong');

  return count;
}

export async function cancelBookingAsOperator(input: {
  id: Id<'bookings'>;
  paypalRefundId: string;
}) {
  return convexMutation(api.bookings.cancelBookingAsOperator, input);
}

export async function restartBookingRefund(input: {
  id: Id<'bookings'>;
  paypalRefundId: string;
}) {
  return convexMutation(api.bookings.restartBookingRefund, input);
}

export async function markBookingRefunded(id: Id<'bookings'>) {
  return convexMutation(api.bookings.markBookingRefunded, { id });
}
