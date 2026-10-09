import { beforeEach, describe, expect, it } from 'vitest';

import {
  cancelBookingAsOperator,
  getBookingForOperator,
  markBookingRefunded,
  restartBookingRefund,
} from './bookings';

type Handler = (ctx: never, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown) => (fn as { _handler: Handler })._handler;
const serverSecret = 'test-server-secret';

function fakeCtx(docs: Record<string, Record<string, unknown>>) {
  const patches: [string, Record<string, unknown>][] = [];
  const db = {
    normalizeId: (_table: string, id: string) => (id in docs ? id : null),
    get: async (_table: string, id: string) => docs[id] ?? null,
    patch: async (id: string, fields: Record<string, unknown>) => {
      patches.push([id, fields]);
    },
  };
  return { patches, ctx: { db } as never };
}

const tour = { _id: 'tour_1', price: 40 };
const paid = { _id: 'paid', tourId: 'tour_1', guests: 2, cancelled: null, paymentStatus: 'paid', paypalCaptureId: 'CAP', accessTokenHash: 'secret' };
const failed = { ...paid, _id: 'failed', cancelled: 5, paymentStatus: 'refund_failed', checkoutAttemptId: 'attempt' };

describe('operator Booking functions', () => {
  beforeEach(() => {
    process.env.CONVEX_SERVER_SECRET = serverSecret;
  });

  it('reads the charged total from the Checkout Attempt, falls back to tour price, and hides the token hash', async () => {
    const { ctx } = fakeCtx({ tour_1: tour, paid, failed, attempt: { total: 70 } });
    const get = (bookingId: string) => handler(getBookingForOperator)(ctx, { bookingId, serverSecret });

    await expect(get('failed')).resolves.toMatchObject({ total: 70 });
    const res = (await get('paid')) as { total: number; booking: object };
    expect(res.total).toBe(80);
    expect(res.booking).not.toHaveProperty('accessTokenHash');
    await expect(get('not-an-id')).resolves.toBeNull();
  });

  it('cancels a paid Booking without its access token', async () => {
    const { ctx, patches } = fakeCtx({ paid, failed });
    const cancel = (id: string) => handler(cancelBookingAsOperator)(ctx, { id, paypalRefundId: 'R1', serverSecret });

    await cancel('paid');
    await expect(cancel('failed')).resolves.toBe('failed');
    await expect(cancel('missing')).rejects.toThrow('Booking not found');
    expect(patches).toEqual([
      ['paid', expect.objectContaining({ paymentStatus: 'refund_pending', paypalRefundId: 'R1' })],
    ]);
  });

  it('only restarts or settles refunds that failed', async () => {
    const { ctx, patches } = fakeCtx({ paid, failed });

    await handler(restartBookingRefund)(ctx, { id: 'failed', paypalRefundId: 'R2', serverSecret });
    await handler(markBookingRefunded)(ctx, { id: 'failed', serverSecret });
    await expect(
      handler(restartBookingRefund)(ctx, { id: 'paid', paypalRefundId: 'R2', serverSecret }),
    ).rejects.toThrow('Booking refund has not failed');
    await expect(handler(markBookingRefunded)(ctx, { id: 'paid', serverSecret })).rejects.toThrow(
      'Booking refund has not failed',
    );
    expect(patches).toEqual([
      ['failed', expect.objectContaining({ paymentStatus: 'refund_pending', paypalRefundId: 'R2' })],
      ['failed', expect.objectContaining({ paymentStatus: 'refunded' })],
    ]);
  });
});
