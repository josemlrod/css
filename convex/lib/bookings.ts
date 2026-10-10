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
