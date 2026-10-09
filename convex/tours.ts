import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { serverMutation, serverQuery } from './lib/serverFunctions';

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
        // Price, capacity, start times, and meeting point are edited by the operator in /admin/tours,
        // so reseeding only refreshes descriptive content on existing tours.
        const {
          price: _price,
          maxGuests: _maxGuests,
          startTimes: _startTimes,
          meetingPoint: _meetingPoint,
          ...content
        } = tour;
        await ctx.db.patch(existingTour._id, { ...content, updatedAt: Date.now() });
      } else {
        await ctx.db.insert('tours', { ...tour, updatedAt: Date.now() });
      }
    }

    return tours.length;
  },
});

export const updateTourSettings = serverMutation({
  args: {
    id: v.id('tours'),
    price: v.number(),
    maxGuests: v.number(),
    startTimes: v.array(v.string()),
    meetingPoint: v.string(),
  },
  handler: async (ctx, { id, ...settings }) => {
    await ctx.db.patch(id, { ...settings, updatedAt: Date.now() });
    return id;
  },
});

export const setTourDateBlocked = serverMutation({
  args: {
    tourIds: v.array(v.id('tours')),
    date: v.string(),
    blocked: v.boolean(),
  },
  handler: async (ctx, { tourIds, date, blocked }) => {
    for (const id of tourIds) {
      const tour = await ctx.db.get('tours', id);
      if (!tour) continue;

      const rest = (tour.blockedDates ?? []).filter((d) => d !== date);

      await ctx.db.patch(id, {
        blockedDates: blocked ? [...rest, date].sort() : rest,
        updatedAt: Date.now(),
      });
    }

    return tourIds.length;
  },
});
