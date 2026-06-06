import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

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
    paymentStatus: v.optional(v.literal('paid')),
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
