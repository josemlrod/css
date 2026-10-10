import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

// The amount actually charged lives on the Checkout Attempt, so later price edits don't rewrite history.
export async function getBookingTotal(
  ctx: QueryCtx,
  booking: Doc<'bookings'>,
  tourPrice: number,
) {
  const checkoutAttempt = booking.checkoutAttemptId
    ? await ctx.db.get('checkoutAttempts', booking.checkoutAttemptId)
    : null;

  return checkoutAttempt?.total ?? tourPrice * booking.guests;
}

// A paid Booking gets its first refund when it's canceled. A canceled Booking whose refund
// failed can have it retried. Anything else has nothing to refund.
export function bookingRefundAttempt(
  booking: Pick<Doc<'bookings'>, 'cancelled' | 'paymentStatus' | 'paypalCaptureId'>,
) {
  if (!booking.paypalCaptureId) return null;
  if (!booking.cancelled && booking.paymentStatus === 'paid') return 'first' as const;
  if (booking.cancelled && booking.paymentStatus === 'refund_failed') return 'retry' as const;

  return null;
}
