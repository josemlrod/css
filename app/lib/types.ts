import type { Doc, Id } from '../../convex/_generated/dataModel';

type Tour = Doc<'tours'>;
type NormalizedTour = Omit<Tour, '_id' | '_creationTime' | 'updatedAt'>;
type TourId = Id<'tours'>;

type Booking = Doc<'bookings'>;
type NormalizedBooking = Omit<Booking, '_id' | '_creationTime' | 'updatedAt'>;
type BookingId = Id<'bookings'>;

type CheckoutAttempt = Doc<'checkoutAttempts'>;
type NormalizedCheckoutAttempt = Omit<
  CheckoutAttempt,
  '_id' | '_creationTime' | 'updatedAt'
>;
type CheckoutAttemptId = Id<'checkoutAttempts'>;

export type {
  Tour,
  NormalizedTour,
  TourId,
  Booking,
  NormalizedBooking,
  BookingId,
  CheckoutAttempt,
  NormalizedCheckoutAttempt,
  CheckoutAttemptId,
};
