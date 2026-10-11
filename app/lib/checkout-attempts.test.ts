import { describe, expect, it, vi } from 'vitest';

import { hashAccessToken } from './access-tokens';
import { CHECKOUT_ATTEMPT_TTL_MS, saveCheckoutAttempt } from './checkout-attempts';

const { mutationMock } = vi.hoisted(() => ({
  mutationMock: vi.fn().mockResolvedValue('checkout-attempt-123'),
}));

vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function () {
    return { mutation: mutationMock };
  }),
}));

describe('checkout attempts', () => {
  it('persists default pending shape with 30 minute expiration', async () => {
    process.env.CONVEX_SERVER_SECRET = 'test-server-secret';
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const result = await saveCheckoutAttempt({
      tourId: 'tour-123' as never,
      date: '2026-01-02',
      time: '11:30 AM',
      guests: 2,
      bookerName: 'Ada Lovelace',
      bookerEmail: 'ada@example.com',
      unitPrice: 79,
      total: 158,
      currency: 'usd',
    });

    expect(result.checkoutAttemptId).toBe('checkout-attempt-123');
    expect(result.expiresAt).toBe(Date.now() + CHECKOUT_ATTEMPT_TTL_MS);
    expect(result.accessToken).toHaveLength(43);
    expect(mutationMock).toHaveBeenCalledWith(expect.anything(), {
      tourId: 'tour-123',
      date: '2026-01-02',
      time: '11:30 AM',
      guests: 2,
      bookerName: 'Ada Lovelace',
      bookerEmail: 'ada@example.com',
      unitPrice: 79,
      total: 158,
      currency: 'usd',
      paypalOrderId: null,
      paymentStatus: 'pending',
      expiresAt: Date.now() + CHECKOUT_ATTEMPT_TTL_MS,
      accessTokenHash: hashAccessToken(result.accessToken),
      serverSecret: 'test-server-secret',
    });

    vi.useRealTimers();
  });
});
