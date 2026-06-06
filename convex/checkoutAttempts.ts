import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

const paymentStatus = v.union(
  v.literal('pending'),
  v.literal('paid'),
  v.literal('expired'),
  v.literal('failed'),
  v.literal('refund_pending'),
  v.literal('refunded'),
  v.literal('refund_failed'),
);

export const getCheckoutAttemptById = query({
  args: { checkoutAttemptId: v.id('checkoutAttempts') },
  handler: async (ctx, { checkoutAttemptId }) => {
    return await ctx.db.get(checkoutAttemptId);
  },
});

export const getCheckoutAttemptWithTour = query({
  args: { checkoutAttemptId: v.id('checkoutAttempts') },
  handler: async (ctx, { checkoutAttemptId }) => {
    const checkoutAttempt = await ctx.db.get(checkoutAttemptId);
    if (!checkoutAttempt) return null;

    const tour = await ctx.db.get(checkoutAttempt.tourId);
    return { checkoutAttempt, tour };
  },
});

export const createCheckoutAttempt = mutation({
  args: {
    tourId: v.id('tours'),
    date: v.string(),
    time: v.string(),
    guests: v.number(),
    bookerName: v.string(),
    bookerEmail: v.string(),
    unitPrice: v.number(),
    total: v.number(),
    currency: v.string(),
    stripeCheckoutSessionId: v.union(v.string(), v.null()),
    paymentStatus,
    expiresAt: v.number(),
    accessTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const time = new Date().getTime();
    return await ctx.db.insert('checkoutAttempts', { ...args, updatedAt: time });
  },
});

export const updateCheckoutAttempt = mutation({
  args: {
    id: v.id('checkoutAttempts'),
    stripeCheckoutSessionId: v.optional(v.union(v.string(), v.null())),
    paymentStatus: v.optional(paymentStatus),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const existing = await ctx.db.get(id);

    if (!existing) {
      throw new Error('Checkout Attempt not found');
    }

    await ctx.db.patch(id, { ...updates, updatedAt: new Date().getTime() });

    return id;
  },
});

export const completeCheckoutAttempt = mutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    amountTotal: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (
    ctx,
    { stripeCheckoutSessionId, amountTotal, currency, stripePaymentIntentId },
  ) => {
    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) =>
        q.eq(q.field('stripeCheckoutSessionId'), stripeCheckoutSessionId),
      )
      .first();

    if (!checkoutAttempt) {
      throw new Error('Checkout Attempt not found');
    }

    const existingBooking = await ctx.db
      .query('bookings')
      .filter((q) => q.eq(q.field('checkoutAttemptId'), checkoutAttempt._id))
      .first();

    if (existingBooking) {
      return existingBooking._id;
    }

    if (checkoutAttempt.paymentStatus !== 'pending') {
      throw new Error('Checkout Attempt is not pending');
    }

    if (amountTotal !== checkoutAttempt.total * 100) {
      throw new Error('Checkout amount mismatch');
    }

    if (currency !== checkoutAttempt.currency) {
      throw new Error('Checkout currency mismatch');
    }

    const tour = await ctx.db.get(checkoutAttempt.tourId);

    if (!tour) {
      throw new Error('Tour not found');
    }

    const bookings = await ctx.db
      .query('bookings')
      .filter((q) =>
        q.and(
          q.eq(q.field('tourId'), checkoutAttempt.tourId),
          q.eq(q.field('date'), checkoutAttempt.date),
          q.eq(q.field('time'), checkoutAttempt.time),
          q.eq(q.field('cancelled'), null),
        ),
      )
      .collect();
    const bookedGuests = bookings.reduce((sum, booking) => sum + booking.guests, 0);

    if (bookedGuests + checkoutAttempt.guests > tour.maxGuests) {
      throw new Error('Tour capacity unavailable');
    }

    const now = new Date().getTime();
    const bookingId = await ctx.db.insert('bookings', {
      cancelled: null,
      date: checkoutAttempt.date,
      time: checkoutAttempt.time,
      guests: checkoutAttempt.guests,
      bookerName: checkoutAttempt.bookerName,
      bookerEmail: checkoutAttempt.bookerEmail,
      tourId: checkoutAttempt.tourId,
      checkoutAttemptId: checkoutAttempt._id,
      accessTokenHash: checkoutAttempt.accessTokenHash,
      stripePaymentIntentId,
      paymentStatus: 'paid',
      updatedAt: now,
    });

    await ctx.db.patch(checkoutAttempt._id, {
      paymentStatus: 'paid',
      updatedAt: now,
    });

    return bookingId;
  },
});

export const expireCheckoutAttempt = mutation({
  args: { stripeCheckoutSessionId: v.string() },
  handler: async (ctx, { stripeCheckoutSessionId }) => {
    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) =>
        q.eq(q.field('stripeCheckoutSessionId'), stripeCheckoutSessionId),
      )
      .first();

    if (!checkoutAttempt) {
      throw new Error('Checkout Attempt not found');
    }

    if (checkoutAttempt.paymentStatus === 'pending') {
      await ctx.db.patch(checkoutAttempt._id, {
        paymentStatus: 'expired',
        updatedAt: new Date().getTime(),
      });
    }

    return checkoutAttempt._id;
  },
});
