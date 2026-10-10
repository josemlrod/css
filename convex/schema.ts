import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,
  // Operators who can sign in to /admin. Convex Auth's default users table, trimmed to name and email.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
  }).index('email', ['email']),

  tours: defineTable({
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
    // YYYY-MM-DD dates the operator closed from /admin/closed-dates. The seed never sets it.
    blockedDates: v.optional(v.array(v.string())),
    // Only seedTestTour sets it. Signed-in Operators can book it; everyone else gets a 404.
    test: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index('by_slug', ['slug']),

  bookings: defineTable({
    cancelled: v.union(v.number(), v.null()),
    date: v.string(),
    time: v.string(),
    guests: v.number(),
    bookerName: v.string(),
    bookerEmail: v.string(),
    tourId: v.id('tours'),
    checkoutAttemptId: v.optional(v.id('checkoutAttempts')),
    accessTokenHash: v.optional(v.string()),
    paypalCaptureId: v.optional(v.string()),
    paymentStatus: v.optional(
      v.union(
        v.literal('paid'),
        v.literal('refund_pending'),
        v.literal('refunded'),
        v.literal('refund_failed'),
      ),
    ),
    paypalRefundId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_checkoutAttemptId', ['checkoutAttemptId'])
    .index('by_paypalRefundId', ['paypalRefundId'])
    .index('by_paymentStatus', ['paymentStatus'])
    .index('by_cancelled', ['cancelled'])
    .index('by_tour_date_time_cancelled', ['tourId', 'date', 'time', 'cancelled']),

  checkoutAttempts: defineTable({
    tourId: v.id('tours'),
    date: v.string(),
    time: v.string(),
    guests: v.number(),
    bookerName: v.string(),
    bookerEmail: v.string(),
    unitPrice: v.number(),
    total: v.number(),
    currency: v.string(),
    paypalOrderId: v.union(v.string(), v.null()),
    paymentStatus: v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('expired'),
      v.literal('failed'),
      v.literal('refund_pending'),
      v.literal('refunded'),
      v.literal('refund_failed'),
    ),
    expiresAt: v.number(),
    accessTokenHash: v.string(),
    failureReason: v.optional(v.literal('capacity_unavailable')),
    paypalRefundId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_paypalOrderId', ['paypalOrderId'])
    .index('by_paypalRefundId', ['paypalRefundId']),
});
