import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

const bookingPaymentStatus = v.union(
  v.literal('paid'),
  v.literal('refund_pending'),
  v.literal('refunded'),
  v.literal('refund_failed'),
);

export const getBookingById = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get('bookings', bookingId);
    return booking;
  },
});

export const getBookingWithTour = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get('bookings', bookingId);
    if (!booking) return null;

    const tourId = booking.tourId;
    const tour = await ctx.db.get('tours', tourId);

    return { booking, tour };
  },
});

export const getBookingWithTourForAccess = query({
  args: { bookingId: v.id('bookings'), accessTokenHash: v.string() },
  handler: async (ctx, { bookingId, accessTokenHash }) => {
    const booking = await ctx.db.get('bookings', bookingId);

    if (!booking || booking.accessTokenHash !== accessTokenHash) return null;

    const tour = await ctx.db.get('tours', booking.tourId);

    return { booking, tour };
  },
});

export const createBooking = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    guests: v.number(),
    bookerName: v.string(),
    bookerEmail: v.string(),
    tourId: v.id('tours'),
    cancelled: v.union(v.null(), v.number()),
    checkoutAttemptId: v.optional(v.id('checkoutAttempts')),
    accessTokenHash: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    paymentStatus: v.optional(bookingPaymentStatus),
    stripeRefundId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const time = new Date().getTime();
    return await ctx.db.insert('bookings', { ...args, updatedAt: time });
  },
});

export const updateBooking = mutation({
  args: {
    id: v.id('bookings'),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    guests: v.optional(v.number()),
    bookerName: v.optional(v.string()),
    bookerEmail: v.optional(v.string()),
    cancelled: v.optional(v.union(v.null(), v.number())),
    paymentStatus: v.optional(bookingPaymentStatus),
    stripeRefundId: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing) {
      throw new Error('Booking not found');
    }

    await ctx.db.patch(id, { ...updates, updatedAt: new Date().getTime() });

    return id;
  },
});

export const cancelPaidBooking = mutation({
  args: {
    id: v.id('bookings'),
    accessTokenHash: v.string(),
    stripeRefundId: v.string(),
  },
  handler: async (ctx, { id, accessTokenHash, stripeRefundId }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing || existing.accessTokenHash !== accessTokenHash) {
      throw new Error('Booking not found');
    }

    if (existing.cancelled) {
      return id;
    }

    if (!existing.stripePaymentIntentId || existing.paymentStatus !== 'paid') {
      throw new Error('Booking is not refundable');
    }

    const now = new Date().getTime();

    await ctx.db.patch(id, {
      cancelled: now,
      paymentStatus: 'refund_pending',
      stripeRefundId,
      updatedAt: now,
    });

    return id;
  },
});
