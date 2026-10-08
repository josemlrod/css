import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { serverQuery } from './lib/serverFunctions';

const tourFields = {
  slug: v.string(),
  name: v.string(),
  tagline: v.string(),
  description: v.string(),
  longDescription: v.string(),
  duration: v.string(),
  durationMinutes: v.number(),
  price: v.number(),
  maxGuests: v.number(),
  imageUrl: v.string(),
  category: v.string(),
  highlights: v.array(v.string()),
  startTimes: v.array(v.string()),
  meetingPoint: v.string(),
};

export const getTours = serverQuery({
  args: {},
  handler: async (ctx) => {
    const tours = await ctx.db.query('tours').collect();
    return tours;
  },
});

export const getTourBySlug = serverQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query('tours')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
  },
});

export const seedTours = internalMutation({
  args: {
    tours: v.array(v.object(tourFields)),
  },
  handler: async (ctx, { tours }) => {
    // Update tours in place by slug so tour IDs stay stable for Bookings and links.
    for (const tour of tours) {
      const existingTour = await ctx.db
        .query('tours')
        .withIndex('by_slug', (q) => q.eq('slug', tour.slug))
        .unique();

      if (existingTour) {
        await ctx.db.patch(existingTour._id, { ...tour, updatedAt: Date.now() });
      } else {
        await ctx.db.insert('tours', { ...tour, updatedAt: Date.now() });
      }
    }

    return tours.length;
  },
});
