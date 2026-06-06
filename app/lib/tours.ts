import { ConvexHttpClient } from 'convex/browser';

import { tryCatch } from './utils';
import type { TourId } from './types';

import { api } from '../../convex/_generated/api';

const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export async function getTours() {
  const [tours, err] = await tryCatch(convex.query(api.tours.getTours));

  if (err) throw new Error('Something went wrong');

  return tours;
}

export async function getTourById(tourId: TourId) {
  const [tour, err] = await tryCatch(
    convex.query(api.tours.getTourById, { tourId }),
  );

  if (err) throw new Error('Something went wrong');

  return tour;
}
