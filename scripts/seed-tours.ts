import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api';
import { tours } from '../app/lib/mock-data';

const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error('Set CONVEX_URL or VITE_CONVEX_URL before running this script.');
}

const seedTours = tours.map(
  ({
    slug,
    name,
    tagline,
    description,
    longDescription,
    duration,
    durationMinutes,
    price,
    maxGuests,
    image,
    category,
    highlights,
    startTimes,
    meetingPoint,
  }) => ({
    slug,
    name,
    tagline,
    description,
    longDescription,
    duration,
    durationMinutes,
    price,
    maxGuests,
    imageUrl: image,
    category,
    highlights,
    startTimes,
    meetingPoint,
  }),
);

const client = new ConvexHttpClient(convexUrl);
const insertedCount = await client.mutation(api.tours.seedTours, {
  tours: seedTours,
});

console.log(`Seeded ${insertedCount} tours.`);
