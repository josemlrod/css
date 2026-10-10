import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  completeCheckoutAttempt,
  failCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
} from './checkout-attempts';
import { completeCapture } from './checkout-completion';
import { sendBookingCommunication } from './email';
import { refundCheckoutAttempt } from './refunds';

vi.mock('./checkout-attempts', () => ({
  completeCheckoutAttempt: vi.fn(),
  failCheckoutAttempt: vi.fn(),
  generateCheckoutAccessToken: vi.fn(() => 'raw_booking_token'),
  hashCheckoutAccessToken: vi.fn(() => 'hashed_booking_token'),
}));

vi.mock('./email', () => ({ sendBookingCommunication: vi.fn() }));

vi.mock('./refunds', () => ({ refundCheckoutAttempt: vi.fn() }));

const completeCheckoutAttemptMock = vi.mocked(completeCheckoutAttempt);
const generateCheckoutAccessTokenMock = vi.mocked(generateCheckoutAccessToken);
const hashCheckoutAccessTokenMock = vi.mocked(hashCheckoutAccessToken);
const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);
const refundCheckoutAttemptMock = vi.mocked(refundCheckoutAttempt);

const checkoutAttempt = {
  _id: 'checkout_attempt_123',
  bookerEmail: 'booker@example.com',
  bookerName: 'Test Booker',
  date: '2026-07-04',
  time: '10:00 AM',
  guests: 2,
  total: 158,
};

const tour = {
  name: 'Savannah Food Tour',
  meetingPoint: 'City Market',
};

const capture = {
  status: 'COMPLETED',
  paypalOrderId: 'ORDER123',
  paypalCaptureId: 'CAPTURE123',
  amountValue: '158.00',
  currency: 'USD',
} as const;

describe('completeCapture', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_ORIGIN;
  });

  it('creates a Booking and sends its Booking Communication', async () => {
    process.env.APP_ORIGIN = 'https://example.com';
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'booking_created',
      bookingId: 'booking_123',
      checkoutAttempt,
      tour,
    } as never);

    await expect(completeCapture(capture)).resolves.toBe('paid');
    expect(completeCheckoutAttemptMock).toHaveBeenCalledWith({
      paypalOrderId: 'ORDER123',
      paypalCaptureId: 'CAPTURE123',
      amountValue: '158.00',
      currency: 'USD',
      bookingAccessTokenHash: 'hashed_booking_token',
    });
    expect(generateCheckoutAccessTokenMock).toHaveBeenCalledOnce();
    expect(hashCheckoutAccessTokenMock).toHaveBeenCalledWith('raw_booking_token');
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith(
      {
        to: 'booker@example.com',
        bookerName: 'Test Booker',
        tourName: 'Savannah Food Tour',
        date: '2026-07-04',
        time: '10:00 AM',
        guests: 2,
        total: 158,
        meetingPoint: 'City Market',
        editUrl: 'https://example.com/manage/booking_123?token=raw_booking_token',
        cancelUrl: 'https://example.com/manage/booking_123?token=raw_booking_token',
      },
      { bookingId: 'booking_123' },
    );
  });

  it('does not repeat side effects when the Booking already exists', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'booking_exists',
      bookingId: 'booking_123',
    } as never);

    await expect(completeCapture(capture)).resolves.toBe('paid');
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(refundCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('refunds the capture when capacity is unavailable', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundCheckoutAttemptMock.mockResolvedValueOnce('refund_pending');

    await expect(completeCapture(capture)).resolves.toBe('refund_pending');
    expect(refundCheckoutAttemptMock).toHaveBeenCalledWith({
      checkoutAttempt,
      tour,
      paypalCaptureId: 'CAPTURE123',
    });
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });

  it('propagates completion mutation failures', async () => {
    const mutationError = new Error('Checkout amount mismatch');
    completeCheckoutAttemptMock.mockRejectedValueOnce(mutationError);

    await expect(completeCapture(capture)).rejects.toThrow(mutationError);
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(refundCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('returns the Payment Status of an attempt that is already settled', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'refunded',
      checkoutAttemptId: 'checkout_attempt_123',
    } as never);

    await expect(completeCapture(capture)).resolves.toBe('refunded');
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(refundCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('leaves a pending capture pending for the webhook', async () => {
    await expect(
      completeCapture({ status: 'PENDING', paypalOrderId: 'ORDER123' }),
    ).resolves.toBe('pending');
    expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
    expect(vi.mocked(failCheckoutAttempt)).not.toHaveBeenCalled();
  });

  it.each(['DECLINED', 'FAILED'])(
    'marks a %s capture failed without a Booking',
    async (status) => {
      await expect(
        completeCapture({ status, paypalOrderId: 'ORDER123' }),
      ).resolves.toBe('failed');
      expect(vi.mocked(failCheckoutAttempt)).toHaveBeenCalledWith({
        paypalOrderId: 'ORDER123',
      });
      expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
    },
  );

  it('rejects an unsupported capture status', async () => {
    await expect(
      completeCapture({ status: 'REFUNDED', paypalOrderId: 'ORDER123' }),
    ).rejects.toThrow('Unsupported PayPal capture status: REFUNDED');
    expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
  });
});
