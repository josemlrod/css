import { afterEach, describe, expect, it, vi } from 'vitest';

import { cancelPaidBooking, getBookingWithTourForAccess } from '~/lib/bookings';
import { hashCheckoutAccessToken } from '~/lib/checkout-attempts';
import {
  sendBookingCancellationRefundFailedCommunication,
  sendBookingCancellationRefundRequestedCommunication,
} from '~/lib/email';
import { refundPayPalCapture } from '~/lib/paypal';

import { action, loader, manageCancellationCopy } from './manage-tour';

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

function request(url = 'https://example.com/manage/booking_123?token=raw_token') {
  return new Request(url, { method: 'POST', body: '{}' });
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
    getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'COMPLETED',
    });

    await expect(action(args())).resolves.toEqual({ view: 'cancelled' });

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
    expect(sendBookingCancellationRefundRequestedCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2099-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
  });

  it('keeps Booking active when refund creation fails', async () => {
    getBookingWithTourForAccessMock.mockResolvedValueOnce({ booking, tour } as never);
    refundPayPalCaptureMock.mockRejectedValueOnce(new Error('refund failed'));

    await expect(action(args())).resolves.toEqual({ view: 'refund_failed' });

    expect(cancelPaidBookingMock).not.toHaveBeenCalled();
    expect(sendBookingCancellationRefundFailedCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2099-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
  });

  it('keeps manage copy focused on cancellation-only v1', () => {
    expect(manageCancellationCopy.heading).toBe('manage cancellation');
    expect(manageCancellationCopy.paymentStatus).toBe(
      'Payment Status: refund pending',
    );
  });
});
