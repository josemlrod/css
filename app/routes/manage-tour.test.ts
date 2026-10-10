import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cancelPaidBooking, getBookingWithTourForAccess } from '~/lib/bookings';
import { hashCheckoutAccessToken } from '~/lib/checkout-attempts';
import {
  sendBookingCancellationRefundFailedCommunication,
  sendBookingCancellationRefundRequestedCommunication,
  sendOperatorNotification,
} from '~/lib/email';
import { refundPayPalCapture } from '~/lib/paypal';

import { action, loader } from './manage-tour';

vi.mock('~/lib/bookings', () => ({
  cancelPaidBooking: vi.fn(),
  getBookingWithTourForAccess: vi.fn(),
}));

vi.mock('~/lib/checkout-attempts', () => ({
  hashCheckoutAccessToken: vi.fn(() => 'hashed_token'),
}));

vi.mock('~/lib/email', () => ({
  sendBookingCancellationRefundFailedCommunication: vi.fn(),
  sendBookingCancellationRefundRequestedCommunication: vi.fn(),
  sendOperatorNotification: vi.fn(),
}));

vi.mock('~/lib/paypal', () => ({
  refundPayPalCapture: vi.fn(),
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

const getBookingWithTourForAccessMock = vi.mocked(getBookingWithTourForAccess);
const cancelPaidBookingMock = vi.mocked(cancelPaidBooking);
const hashCheckoutAccessTokenMock = vi.mocked(hashCheckoutAccessToken);
const refundPayPalCaptureMock = vi.mocked(refundPayPalCapture);
const sendBookingCancellationRefundFailedCommunicationMock = vi.mocked(
  sendBookingCancellationRefundFailedCommunication,
);
const sendBookingCancellationRefundRequestedCommunicationMock = vi.mocked(
  sendBookingCancellationRefundRequestedCommunication,
);

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
    expect(refundPayPalCaptureMock).not.toHaveBeenCalled();
    expect(cancelPaidBookingMock).not.toHaveBeenCalled();
  });

  it('rejects invalid token without refunding', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce(null);

    const response = await action(args());

    expect(response).toMatchObject({ init: { status: 403 } });
    expect(refundPayPalCaptureMock).not.toHaveBeenCalled();
    expect(cancelPaidBookingMock).not.toHaveBeenCalled();
  });

  it('creates refund before canceling Booking', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour, total } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'COMPLETED',
    });
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      action(args(request(undefined, JSON.stringify({ reason: 'Weather concerns' })))),
    ).resolves.toEqual({ view: 'cancelled' });

    expect(consoleLogMock.mock.calls.map(([line]) => JSON.parse(line))).toMatchObject([
      { event: 'cancellation.requested', cancelReason: 'Weather concerns' },
      { event: 'cancellation.completed', paypalRefundId: 'REFUND123' },
    ]);

    expect(hashCheckoutAccessTokenMock).toHaveBeenCalledWith('raw_token');
    expect(refundPayPalCaptureMock).toHaveBeenCalledWith('CAPTURE123');
    expect(cancelPaidBookingMock).toHaveBeenCalledWith({
      id: 'booking_123',
      accessTokenHash: 'hashed_token',
      paypalRefundId: 'REFUND123',
    });
    expect(refundPayPalCaptureMock.mock.invocationCallOrder[0]).toBeLessThan(
      cancelPaidBookingMock.mock.invocationCallOrder[0],
    );
    expect(sendBookingCancellationRefundRequestedCommunicationMock).toHaveBeenCalledWith(
      {
        to: 'booker@example.com',
        bookerName: 'Test Booker',
        tourName: 'Savannah Food Tour',
        date: '2099-07-04',
        time: '10:00 AM',
        guests: 2,
        total: 150,
      },
      { bookingId: 'booking_123' },
    );
    expect(vi.mocked(sendOperatorNotification)).toHaveBeenCalledWith(
      'booker_canceled',
      sendBookingCancellationRefundRequestedCommunicationMock.mock.calls[0][0],
      { bookingId: 'booking_123' },
    );
  });

  it('keeps Booking active when refund creation fails', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour, total } as never);
    refundPayPalCaptureMock.mockRejectedValueOnce(new Error('refund failed'));
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(action(args())).resolves.toEqual({ view: 'refund_failed' });

    expect(JSON.parse(consoleErrorMock.mock.calls[0][0])).toMatchObject({
      event: 'cancellation.refund_failed',
      bookingId: 'booking_123',
      paypalCaptureId: 'CAPTURE123',
      error: { message: 'refund failed' },
    });

    expect(cancelPaidBookingMock).not.toHaveBeenCalled();
    expect(sendBookingCancellationRefundFailedCommunicationMock).toHaveBeenCalledWith(
      {
        to: 'booker@example.com',
        bookerName: 'Test Booker',
        tourName: 'Savannah Food Tour',
        date: '2099-07-04',
        time: '10:00 AM',
        guests: 2,
        total: 150,
      },
      { bookingId: 'booking_123' },
    );
  });

  it.each(['FAILED', 'CANCELLED'])(
    'keeps Booking active when PayPal returns %s',
    async (status) => {
      getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour, total } as never);
      refundPayPalCaptureMock.mockResolvedValueOnce({ id: 'REFUND123', status });

      await expect(action(args())).resolves.toEqual({ view: 'refund_failed' });

      expect(cancelPaidBookingMock).not.toHaveBeenCalled();
      expect(sendBookingCancellationRefundFailedCommunicationMock).toHaveBeenCalledOnce();
      expect(sendBookingCancellationRefundRequestedCommunicationMock).not.toHaveBeenCalled();
    },
  );
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
      refundPayPalCaptureMock.mockResolvedValue({
        id: 'REFUND123',
        status: 'COMPLETED',
      });
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
