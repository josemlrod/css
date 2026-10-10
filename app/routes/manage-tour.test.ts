import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashAccessToken } from '~/lib/access-tokens';
import { convexQuery } from '~/lib/convex.server';
import { convexCalls } from '~/lib/convex.test-helpers';
import { refundBooking } from '~/lib/refunds';

import { action, loader } from './manage-tour';

vi.mock('~/lib/convex.server', () => ({
  convexQuery: vi.fn(),
}));

vi.mock('~/lib/access-tokens', () => ({
  hashAccessToken: vi.fn(() => 'hashed_token'),
}));

vi.mock('~/lib/refunds', () => ({
  refundBooking: vi.fn(),
}));

const booking = {
  _id: 'booking_123',
  accessTokenHash: 'hashed_token',
  bookerEmail: 'booker@example.com',
  bookerName: 'Test Booker',
  cancelled: null,
  date: '2099-07-04',
  time: '10:00 AM',
  guests: 2,
  paypalCaptureId: 'CAPTURE123',
  paymentStatus: 'paid',
};

const tour = {
  name: 'Savannah Food Tour',
  price: 79,
};

// What the Booker paid before the tour price changed, not 2 × $79.
const total = 150;

const getBookingWithTourForAccessMock = vi.mocked(convexQuery);
const hashAccessTokenMock = vi.mocked(hashAccessToken);
const refundBookingMock = vi.mocked(refundBooking);

function request(
  url = 'https://example.com/manage/booking_123?token=raw_token',
  body = '{}',
) {
  return new Request(url, { method: 'POST', body });
}

function args(req = request()) {
  return {
    request: req,
    params: { bookingId: 'booking_123' },
    context: {},
  } as never;
}

describe('manage tour cancellation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects loader access without valid token', async () => {
    await expect(
      loader(args(new Request('https://example.com/manage/booking_123'))),
    ).rejects.toMatchObject({ status: 302 });
    expect(getBookingWithTourForAccessMock).not.toHaveBeenCalled();
  });

  it('blocks cancellation inside 24-hour cutoff without refunding', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({
      booking: { ...booking, date: '2000-01-01' },
      tour,
    } as never);

    await expect(action(args())).resolves.toEqual({ view: 'cutoff_blocked' });
    expect(refundBookingMock).not.toHaveBeenCalled();
  });

  it('rejects invalid token without refunding', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce(null);

    const response = await action(args());

    expect(response).toMatchObject({ init: { status: 403 } });
    expect(refundBookingMock).not.toHaveBeenCalled();
  });

  it('refunds as the Booker and logs the cancel reason', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour, total } as never);
    refundBookingMock.mockResolvedValueOnce('refund_requested');
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      action(args(request(undefined, JSON.stringify({ reason: 'Weather concerns' })))),
    ).resolves.toEqual({ view: 'cancelled' });

    expect(JSON.parse(consoleLogMock.mock.calls[0][0])).toMatchObject({
      event: 'cancellation.requested',
      cancelReason: 'Weather concerns',
    });
    expect(hashAccessTokenMock).toHaveBeenCalledWith('raw_token');
    expect(convexCalls(getBookingWithTourForAccessMock)).toEqual([
      [
        'bookings:getBookingWithTourForAccess',
        { bookingId: 'booking_123', accessTokenHash: 'hashed_token' },
      ],
    ]);
    expect(refundBookingMock).toHaveBeenCalledWith({
      booking,
      tour,
      total,
      by: 'booker',
      attempt: 'first',
    });
  });

  it.each([
    ['refund_requested', booking, 'cancelled'],
    ['record_failed', booking, 'cancelled'],
    ['refund_failed', booking, 'refund_failed'],
    ['not_refundable', booking, 'refund_failed'],
    ['not_refundable', { ...booking, cancelled: 1 }, 'cancelled'],
  ] as const)('shows a %s refund as the %s view', async (outcome, current, view) => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({
      booking: current,
      tour,
      total,
    } as never);
    refundBookingMock.mockResolvedValueOnce(outcome);

    await expect(action(args())).resolves.toEqual({ view });
  });
});

describe.each(['UTC', 'America/New_York'])(
  'self-cancel cutoff with TZ=%s',
  (tz) => {
    // 9:00 AM Eastern the day after DST ends is 14:00Z, so the cutoff is 2026-11-01T14:00Z.
    const dstBooking = { ...booking, date: '2026-11-02', time: '9:00 AM' };
    const originalTz = process.env.TZ;

    beforeEach(() => {
      process.env.TZ = tz;
      vi.useFakeTimers({ toFake: ['Date'] });
      refundBookingMock.mockResolvedValue('refund_requested');
    });

    afterEach(() => {
      process.env.TZ = originalTz;
      vi.useRealTimers();
      vi.resetAllMocks();
    });

    it.each([
      ['2026-11-01T13:59:00Z', 'cancelled'],
      ['2026-11-01T14:01:00Z', 'cutoff_blocked'],
    ])('at %s returns %s', async (now, view) => {
      vi.setSystemTime(new Date(now));
      getBookingWithTourForAccessMock.mockResolvedValueOnce({
        booking: dstBooking,
        tour,
      } as never);

      await expect(action(args())).resolves.toEqual({ view });
    });
  },
);
