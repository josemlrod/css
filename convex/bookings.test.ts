import { beforeEach, describe, expect, it } from 'vitest';

import {
  getBookingForOperator,
  getBookingWithTourForAccess,
  listBookingActivity,
  markBookingRefunded,
  recordBookingRefund,
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
    // Only the `gt` index ranges the activity query uses.
    query: () => {
      const rows = Object.values(docs);
      return {
        collect: async () => rows,
        withIndex: (_index: string, range: (q: object) => unknown) => {
          let keep = (_doc: Record<string, unknown>) => true;
          range({
            gt: (field: string, value: number) => {
              keep = (doc) => typeof doc[field] === 'number' && (doc[field] as number) > value;
            },
          });
          return { collect: async () => rows.filter(keep) };
        },
      };
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

  it('gives the Booker the charged total only with the right access token', async () => {
    const { ctx } = fakeCtx({ tour_1: tour, failed, attempt: { total: 70 } });
    const get = (accessTokenHash: string) =>
      handler(getBookingWithTourForAccess)(ctx, { bookingId: 'failed', accessTokenHash, serverSecret });

    await expect(get('secret')).resolves.toMatchObject({ total: 70 });
    await expect(get('wrong')).resolves.toBeNull();
  });

  it('lists Bookings made or canceled after a time, newest first', async () => {
    const { ctx } = fakeCtx({
      tour_1: { ...tour, name: 'Ghost Tour' },
      paid: { ...paid, _creationTime: 30 },
      failed: { ...failed, _creationTime: 10, cancelled: 40 },
      old: { ...paid, _id: 'old', _creationTime: 5 },
    });
    const activity = (await handler(listBookingActivity)(ctx, { since: 20, serverSecret })) as object[];

    expect(activity).toEqual([
      expect.objectContaining({ type: 'canceled', at: 40, bookingId: 'failed', tourName: 'Ghost Tour' }),
      expect.objectContaining({ type: 'booked', at: 30, bookingId: 'paid' }),
    ]);
  });

  it('records a first refund or a retry only when the Booking allows it', async () => {
    const { ctx, patches } = fakeCtx({ paid, failed, replayed: { ...failed, _id: 'replayed', paypalRefundId: 'R0' } });
    const record = (id: string, attempt: string, paypalRefundId = 'R1') =>
      handler(recordBookingRefund)(ctx, { id, attempt, paypalRefundId, serverSecret });

    await record('paid', 'first');
    await record('failed', 'retry', 'R2');
    await expect(record('replayed', 'retry', 'R0')).resolves.toBe('replayed');
    await expect(record('paid', 'retry')).rejects.toThrow('Booking is not refundable');
    await expect(record('failed', 'first')).rejects.toThrow('Booking is not refundable');
    await expect(record('missing', 'first')).rejects.toThrow('Booking not found');
    expect(patches).toEqual([
      ['paid', expect.objectContaining({ cancelled: expect.any(Number), paymentStatus: 'refund_pending', paypalRefundId: 'R1' })],
      ['failed', expect.objectContaining({ cancelled: 5, paymentStatus: 'refund_pending', paypalRefundId: 'R2' })],
    ]);
  });

  it('only settles refunds that failed', async () => {
    const { ctx, patches } = fakeCtx({ paid, failed });

    await handler(markBookingRefunded)(ctx, { id: 'failed', serverSecret });
    await expect(handler(markBookingRefunded)(ctx, { id: 'paid', serverSecret })).rejects.toThrow(
      'Booking refund has not failed',
    );
    expect(patches).toEqual([['failed', expect.objectContaining({ paymentStatus: 'refunded' })]]);
  });
});
