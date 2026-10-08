import { convexQuery } from './convex.server';
import { tryCatch } from './utils';
import type { TourId } from './types';

import { api } from '../../convex/_generated/api';

export async function getTours() {
  const [tours, err] = await tryCatch(convexQuery(api.tours.getTours, {}));

  if (err) throw new Error('Something went wrong');

  return tours;
}

export async function getTourById(tourId: TourId) {
  const [tour, err] = await tryCatch(
    convexQuery(api.tours.getTourById, { tourId }),
  );

  if (err) throw new Error('Something went wrong');

  return tour;
}
