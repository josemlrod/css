import { v } from 'convex/values';

import { mutation } from './_generated/server';

export const createBooking = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    guests: v.number(),
    bookerName: v.string(),
    bookerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bookings', args);
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
  },
  handler: async (ctx, { id, ...updates }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing) {
      throw new Error('Booking not found');
    }

    await ctx.db.patch(id, updates);

    return id;
  },
});
