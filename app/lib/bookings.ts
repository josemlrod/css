import { ConvexHttpClient } from 'convex/browser';

import type { Doc } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';

type Booking = Omit<Doc<'bookings'>, '_id' | '_creationTime'>;

const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export async function saveBooking(booking: Booking) {
  const bookingId = await convex.mutation(api.bookings.createBooking, booking);
  return bookingId;
}
