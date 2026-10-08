import { v } from 'convex/values';

import { serverMutation, serverQuery } from './lib/serverFunctions';

export const getBookingWithTourForAccess = serverQuery({
  args: { bookingId: v.id('bookings'), accessTokenHash: v.string() },
  handler: async (ctx, { bookingId, accessTokenHash }) => {
    const booking = await ctx.db.get('bookings', bookingId);

    if (!booking || booking.accessTokenHash !== accessTokenHash) return null;

    const tour = await ctx.db.get('tours', booking.tourId);

    return { booking, tour };
  },
});

export const cancelPaidBooking = serverMutation({
  args: {
    id: v.id('bookings'),
    accessTokenHash: v.string(),
    paypalRefundId: v.string(),
  },
  handler: async (ctx, { id, accessTokenHash, paypalRefundId }) => {
    const existing = await ctx.db.get('bookings', id);

    if (!existing || existing.accessTokenHash !== accessTokenHash) {
      throw new Error('Booking not found');
    }

    if (existing.cancelled) {
      return id;
    }

    if (!existing.paypalCaptureId || existing.paymentStatus !== 'paid') {
      throw new Error('Booking is not refundable');
    }

    const now = new Date().getTime();

    await ctx.db.patch(id, {
      cancelled: now,
      paymentStatus: 'refund_pending',
      paypalRefundId,
      updatedAt: now,
    });

    return id;
  },
});
