import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

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

export const getTours = query({
  args: {},
  handler: async (ctx) => {
    const tours = await ctx.db.query('tours').collect();
    return tours;
  },
});

export const getTourById = query({
  args: { tourId: v.id('tours') },
  handler: async (ctx, { tourId }) => {
    const tour = await ctx.db.get('tours', tourId);
    return tour;
  },
});

export const seedTours = mutation({
  args: {
    tours: v.array(v.object(tourFields)),
  },
  handler: async (ctx, { tours }) => {
    for (const tour of tours) {
      const existingTours = await ctx.db
        .query('tours')
        .filter((q) => q.eq(q.field('slug'), tour.slug))
        .collect();

      for (const existingTour of existingTours) {
        await ctx.db.delete(existingTour._id);
      }

      await ctx.db.insert('tours', { ...tour, updatedAt: 0 });
    }

    return tours.length;
  },
});
