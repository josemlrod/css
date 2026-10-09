import { convexMutation, convexQuery } from './convex.server';
import { tryCatch } from './utils';

import { api } from '../../convex/_generated/api';
import type { TourId } from './types';

export async function getTours() {
  const [tours, err] = await tryCatch(convexQuery(api.tours.getTours, {}));

  if (err) throw new Error('Something went wrong');

  return tours;
}

export async function getTourBySlug(slug: string) {
  const [tour, err] = await tryCatch(
    convexQuery(api.tours.getTourBySlug, { slug }),
  );

  if (err) throw new Error('Something went wrong');

  return tour;
}

export async function updateTourSettings(input: {
  id: TourId;
  price: number;
  maxGuests: number;
  startTimes: string[];
  meetingPoint: string;
}) {
  return convexMutation(api.tours.updateTourSettings, input);
}

export async function setTourDateBlocked(input: {
  tourIds: TourId[];
  date: string;
  blocked: boolean;
}) {
  return convexMutation(api.tours.setTourDateBlocked, input);
}
