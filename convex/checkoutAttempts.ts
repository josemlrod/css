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
