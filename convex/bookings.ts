import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { serverMutation, serverQuery } from './lib/serverFunctions';

// The amount actually charged lives on the Checkout Attempt, so later price edits don't rewrite history.
async function getBookingTotal(
  ctx: QueryCtx,
  booking: Doc<'bookings'>,
  tourPrice: number,
) {
  const checkoutAttempt = booking.checkoutAttemptId
    ? await ctx.db.get('checkoutAttempts', booking.checkoutAttemptId)
    : null;

  return checkoutAttempt?.total ?? tourPrice * booking.guests;
}

function withoutAccessToken({ accessTokenHash: _, ...booking }: Doc<'bookings'>) {
  return booking;
}

async function cancelRefundableBooking(
  ctx: MutationCtx,
  existing: Doc<'bookings'>,
  paypalRefundId: string,
) {
  if (existing.cancelled) {
    return existing._id;
  }

  if (!existing.paypalCaptureId || existing.paymentStatus !== 'paid') {
    throw new Error('Booking is not refundable');
  }

  const now = new Date().getTime();

  await ctx.db.patch(existing._id, {
    cancelled: now,
    paymentStatus: 'refund_pending',
    paypalRefundId,
    updatedAt: now,
  });

  return existing._id;
}

export const getBookingWithTourForAccess = serverQuery({
  args: { bookingId: v.id('bookings'), accessTokenHash: v.string() },
  handler: async (ctx, { bookingId, accessTokenHash }) => {
    const booking = await ctx.db.get('bookings', bookingId);

    if (!booking || booking.accessTokenHash !== accessTokenHash) return null;

    const tour = await ctx.db.get('tours', booking.tourId);

    return { booking, tour };
  },
});

export const cancelPaidBooking = serverMutation({
  args: {
    id: v.id('bookings'),
    accessTokenHash: v.string(),
    paypalRefundId: v.string(),
  },
  handler: async (ctx, { id, accessTokenHash, paypalRefundId }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing || existing.accessTokenHash !== accessTokenHash) {
      throw new Error('Booking not found');
    }

    return cancelRefundableBooking(ctx, existing, paypalRefundId);
  },
});

export const listBookingsForOperator = serverQuery({
  args: {},
  handler: async (ctx) => {
    const [bookings, tours] = await Promise.all([
      ctx.db.query('bookings').collect(),
      ctx.db.query('tours').collect(),
    ]);
    const prices = new Map(tours.map((tour) => [tour._id, tour.price]));

    return Promise.all(
      bookings.map(async (booking) => ({
        ...withoutAccessToken(booking),
        total: await getBookingTotal(ctx, booking, prices.get(booking.tourId) ?? 0),
      })),
    );
  },
});

// Bookings made or canceled after `since`, newest first, for the console's Recent activity.
export const listBookingActivity = serverQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const [booked, canceled, tours] = await Promise.all([
      ctx.db
        .query('bookings')
        .withIndex('by_creation_time', (q) => q.gt('_creationTime', since))
        .collect(),
      ctx.db
        .query('bookings')
        .withIndex('by_cancelled', (q) => q.gt('cancelled', since))
        .collect(),
      ctx.db.query('tours').collect(),
    ]);
    const tourNames = new Map(tours.map((tour) => [tour._id, tour.name]));
    const event = (type: 'booked' | 'canceled', at: number, booking: Doc<'bookings'>) => ({
      type,
      at,
      bookingId: booking._id,
      bookerName: booking.bookerName,
      tourName: tourNames.get(booking.tourId) ?? 'Unknown tour',
      date: booking.date,
      time: booking.time,
      guests: booking.guests,
    });

    return [
      ...booked.map((booking) => event('booked', booking._creationTime, booking)),
      ...canceled.map((booking) => event('canceled', booking.cancelled!, booking)),
    ].sort((a, b) => b.at - a.at);
  },
});

export const getBookingForOperator = serverQuery({
  args: { bookingId: v.string() },
  handler: async (ctx, { bookingId }) => {
    const id = ctx.db.normalizeId('bookings', bookingId);
    const booking = id ? await ctx.db.get('bookings', id) : null;

    if (!booking) return null;

    const tour = await ctx.db.get('tours', booking.tourId);

    return {
      booking: withoutAccessToken(booking),
      tour,
      total: await getBookingTotal(ctx, booking, tour?.price ?? 0),
    };
  },
});

export const countRefundFailedBookings = serverQuery({
  args: {},
  handler: async (ctx) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_paymentStatus', (q) => q.eq('paymentStatus', 'refund_failed'))
      .collect();

    return bookings.length;
  },
});

export const cancelBookingAsOperator = serverMutation({
  args: { id: v.id('bookings'), paypalRefundId: v.string() },
  handler: async (ctx, { id, paypalRefundId }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing) throw new Error('Booking not found');

    return cancelRefundableBooking(ctx, existing, paypalRefundId);
  },
});

// A canceled Booking whose refund PayPal rejected gets a fresh refund attempt.
export const restartBookingRefund = serverMutation({
  args: { id: v.id('bookings'), paypalRefundId: v.string() },
  handler: async (ctx, { id, paypalRefundId }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing?.cancelled || existing.paymentStatus !== 'refund_failed') {
      throw new Error('Booking refund has not failed');
    }

    await ctx.db.patch(id, {
      paymentStatus: 'refund_pending',
      paypalRefundId,
      updatedAt: new Date().getTime(),
    });

    return id;
  },
});

// The operator refunded the Booker outside the app, for example in the PayPal dashboard.
export const markBookingRefunded = serverMutation({
  args: { id: v.id('bookings') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing?.cancelled || existing.paymentStatus !== 'refund_failed') {
      throw new Error('Booking refund has not failed');
    }

    await ctx.db.patch(id, {
      paymentStatus: 'refunded',
      updatedAt: new Date().getTime(),
    });

    return id;
  },
});
