import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';

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
    paypalOrderId: v.union(v.string(), v.null()),
    paymentStatus,
    expiresAt: v.number(),
    accessTokenHash: v.string(),
  },
  handler: async (ctx, args): Promise<Id<'checkoutAttempts'>> => {
    const id = await ctx.db.insert('checkoutAttempts', {
      ...args,
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      Math.max(0, args.expiresAt - Date.now()),
      internal.checkoutAttempts.expireIfPending,
      { id },
    );

    return id;
  },
});

export const expireIfPending = internalMutation({
  args: { id: v.id('checkoutAttempts') },
  handler: async (ctx, { id }) => {
    const checkoutAttempt = await ctx.db.get(id);

    if (!checkoutAttempt || checkoutAttempt.paymentStatus !== 'pending') return;

    await ctx.db.patch(id, {
      paymentStatus: 'expired',
      updatedAt: Date.now(),
    });
  },
});

export const updateCheckoutAttempt = mutation({
  args: {
    id: v.id('checkoutAttempts'),
    paypalOrderId: v.optional(v.union(v.string(), v.null())),
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

export const updateCheckoutAttemptRefundStatus = mutation({
  args: {
    id: v.id('checkoutAttempts'),
    paymentStatus: v.union(
      v.literal('refund_pending'),
      v.literal('refunded'),
      v.literal('refund_failed'),
    ),
    paypalRefundId: v.optional(v.string()),
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

export const updateRefundStatusByPayPalRefund = mutation({
  args: {
    paypalRefundId: v.string(),
    paymentStatus: v.union(v.literal('refunded'), v.literal('refund_failed')),
  },
  handler: async (ctx, { paypalRefundId, paymentStatus }) => {
    const booking = await ctx.db
      .query('bookings')
      .filter((q) => q.eq(q.field('paypalRefundId'), paypalRefundId))
      .first();

    if (booking) {
      if (booking.paymentStatus === paymentStatus) {
        return { status: 'already_updated' as const };
      }

      await ctx.db.patch(booking._id, {
        paymentStatus,
        updatedAt: new Date().getTime(),
      });

      const tour = await ctx.db.get(booking.tourId);

      return { status: 'updated_booking' as const, booking, tour };
    }

    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) => q.eq(q.field('paypalRefundId'), paypalRefundId))
      .first();

    if (checkoutAttempt) {
      if (checkoutAttempt.paymentStatus === paymentStatus) {
        return { status: 'already_updated' as const };
      }

      await ctx.db.patch(checkoutAttempt._id, {
        paymentStatus,
        updatedAt: new Date().getTime(),
      });

      const tour = await ctx.db.get(checkoutAttempt.tourId);

      return {
        status: 'updated_checkout_attempt' as const,
        checkoutAttempt,
        tour,
      };
    }

    return { status: 'not_found' as const };
  },
});

export const completeCheckoutAttempt = mutation({
  args: {
    paypalOrderId: v.string(),
    amountValue: v.string(),
    currency: v.string(),
    paypalCaptureId: v.string(),
    bookingAccessTokenHash: v.string(),
  },
  handler: async (
    ctx,
    {
      paypalOrderId,
      amountValue,
      currency,
      paypalCaptureId,
      bookingAccessTokenHash,
    },
  ) => {
    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) =>
        q.eq(q.field('paypalOrderId'), paypalOrderId),
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
      return { status: 'booking_exists' as const, bookingId: existingBooking._id };
    }

    if (checkoutAttempt.paymentStatus !== 'pending') {
      return {
        status: checkoutAttempt.paymentStatus,
        checkoutAttemptId: checkoutAttempt._id,
      };
    }

    if (amountValue !== checkoutAttempt.total.toFixed(2)) {
      throw new Error('Checkout amount mismatch');
    }

    if (currency.toLowerCase() !== checkoutAttempt.currency.toLowerCase()) {
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

    const now = new Date().getTime();

    if (bookedGuests + checkoutAttempt.guests > tour.maxGuests) {
      await ctx.db.patch(checkoutAttempt._id, {
        paymentStatus: 'refund_pending',
        failureReason: 'capacity_unavailable',
        updatedAt: now,
      });

      return {
        status: 'capacity_unavailable' as const,
        checkoutAttempt: { ...checkoutAttempt, paymentStatus: 'refund_pending' as const },
        tour,
      };
    }

    const bookingId = await ctx.db.insert('bookings', {
      cancelled: null,
      date: checkoutAttempt.date,
      time: checkoutAttempt.time,
      guests: checkoutAttempt.guests,
      bookerName: checkoutAttempt.bookerName,
      bookerEmail: checkoutAttempt.bookerEmail,
      tourId: checkoutAttempt.tourId,
      checkoutAttemptId: checkoutAttempt._id,
      accessTokenHash: bookingAccessTokenHash,
      paypalCaptureId,
      paymentStatus: 'paid',
      updatedAt: now,
    });

    await ctx.db.patch(checkoutAttempt._id, {
      paymentStatus: 'paid',
      updatedAt: now,
    });

    return {
      status: 'booking_created' as const,
      bookingId,
      checkoutAttempt,
      tour,
    };
  },
});

export const expireCheckoutAttempt = mutation({
  args: { paypalOrderId: v.string() },
  handler: async (ctx, { paypalOrderId }) => {
    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) =>
        q.eq(q.field('paypalOrderId'), paypalOrderId),
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

export const failCheckoutAttempt = mutation({
  args: { paypalOrderId: v.string() },
  handler: async (ctx, { paypalOrderId }) => {
    const checkoutAttempt = await ctx.db
      .query('checkoutAttempts')
      .filter((q) =>
        q.eq(q.field('paypalOrderId'), paypalOrderId),
      )
      .first();

    if (!checkoutAttempt) {
      throw new Error('Checkout Attempt not found');
    }

    if (checkoutAttempt.paymentStatus === 'pending') {
      await ctx.db.patch(checkoutAttempt._id, {
        paymentStatus: 'failed',
        updatedAt: Date.now(),
      });
    }

    return checkoutAttempt._id;
  },
});
