import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeCheckoutAttempt } from './checkoutAttempts';

const handler = (
  completeCheckoutAttempt as unknown as {
    _handler: (
      context: never,
      args: {
        paypalOrderId: string;
        amountValue: string;
        currency: string;
        paypalCaptureId: string;
        bookingAccessTokenHash: string;
        serverSecret: string;
      },
    ) => Promise<{ status: string }>;
  }
)._handler;

const args = {
  paypalOrderId: 'ORDER-123',
  amountValue: '158.00',
  currency: 'USD',
  paypalCaptureId: 'CAPTURE-123',
  bookingAccessTokenHash: 'booking_token_hash',
};

describe('completeCheckoutAttempt', () => {
  beforeEach(() => {
    process.env.CONVEX_SERVER_SECRET = 'test-server-secret';
  });

  it('rejects callers without the server secret', () => {
    expect(() =>
      handler({} as never, { ...args, serverSecret: 'wrong-secret' }),
    ).toThrow('Unauthorized');

    delete process.env.CONVEX_SERVER_SECRET;

    expect(() => handler({} as never, { ...args, serverSecret: '' })).toThrow(
      'Unauthorized',
    );
  });

  it('reconciles a completed capture after scheduled expiry', async () => {
    const checkoutAttempt = {
      _id: 'checkout_attempt_123',
      _creationTime: 1,
      tourId: 'tour_123',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      bookerName: 'Test Booker',
      bookerEmail: 'booker@example.com',
      unitPrice: 79,
      total: 158,
      currency: 'USD',
      paypalOrderId: 'ORDER-123',
      paymentStatus: 'expired',
      expiresAt: 1,
      accessTokenHash: 'checkout_token_hash',
      updatedAt: 1,
    } as const;
    const tour = {
      _id: 'tour_123',
      _creationTime: 1,
      name: 'Savannah Food Tour',
      maxGuests: 10,
    };
    const insert = vi.fn().mockResolvedValue('booking_123');
    const patch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        query: (table: string) => ({
          withIndex: () => ({
            first: async () =>
              table === 'checkoutAttempts' ? checkoutAttempt : null,
            collect: async () => [],
          }),
        }),
        get: vi.fn().mockResolvedValue(tour),
        insert,
        patch,
      },
    };

    const result = await handler(ctx as never, {
      ...args,
      serverSecret: 'test-server-secret',
    });

    expect(result.status).toBe('booking_created');
    expect(insert).toHaveBeenCalledWith(
      'bookings',
      expect.objectContaining({
        checkoutAttemptId: 'checkout_attempt_123',
        paypalCaptureId: 'CAPTURE-123',
        paymentStatus: 'paid',
      }),
    );
    expect(patch).toHaveBeenCalledWith(
      'checkout_attempt_123',
      expect.objectContaining({ paymentStatus: 'paid' }),
    );
  });
});
