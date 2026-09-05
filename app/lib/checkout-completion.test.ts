import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  completeCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from './checkout-attempts';
import { finalizePaidCapture } from './checkout-completion';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
  sendRefundFailedCommunication,
} from './email';
import { refundPayPalCapture } from './paypal';

vi.mock('./checkout-attempts', () => ({
  completeCheckoutAttempt: vi.fn(),
  generateCheckoutAccessToken: vi.fn(() => 'raw_booking_token'),
  hashCheckoutAccessToken: vi.fn(() => 'hashed_booking_token'),
  updateCheckoutAttemptRefundStatus: vi.fn(),
}));

vi.mock('./email', () => ({
  sendBookingCommunication: vi.fn(),
  sendFailedCapacityRefundCommunication: vi.fn(),
  sendRefundFailedCommunication: vi.fn(),
}));

vi.mock('./paypal', () => ({ refundPayPalCapture: vi.fn() }));

const completeCheckoutAttemptMock = vi.mocked(completeCheckoutAttempt);
const generateCheckoutAccessTokenMock = vi.mocked(generateCheckoutAccessToken);
const hashCheckoutAccessTokenMock = vi.mocked(hashCheckoutAccessToken);
const updateCheckoutAttemptRefundStatusMock = vi.mocked(
  updateCheckoutAttemptRefundStatus,
);
const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);
const sendFailedCapacityRefundCommunicationMock = vi.mocked(
  sendFailedCapacityRefundCommunication,
);
const sendRefundFailedCommunicationMock = vi.mocked(
  sendRefundFailedCommunication,
);
const refundPayPalCaptureMock = vi.mocked(refundPayPalCapture);

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
  paypalOrderId: 'ORDER123',
  paypalCaptureId: 'CAPTURE123',
  amountValue: '158.00',
  currency: 'USD',
};

describe('finalizePaidCapture', () => {
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

    await expect(finalizePaidCapture(capture)).resolves.toMatchObject({
      status: 'booking_created',
      bookingId: 'booking_123',
    });
    expect(completeCheckoutAttemptMock).toHaveBeenCalledWith({
      ...capture,
      bookingAccessTokenHash: 'hashed_booking_token',
    });
    expect(generateCheckoutAccessTokenMock).toHaveBeenCalledOnce();
    expect(hashCheckoutAccessTokenMock).toHaveBeenCalledWith('raw_booking_token');
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith({
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
    });
  });

  it('does not repeat side effects when the Booking already exists', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'booking_exists',
      bookingId: 'booking_123',
    } as never);

    await expect(finalizePaidCapture(capture)).resolves.toMatchObject({
      status: 'booking_exists',
    });
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(refundPayPalCaptureMock).not.toHaveBeenCalled();
  });

  it('refunds a capture and emails the Booker when capacity is unavailable', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'PENDING',
    });

    await expect(finalizePaidCapture(capture)).resolves.toMatchObject({
      status: 'capacity_unavailable',
      paymentStatus: 'refund_pending',
    });
    expect(refundPayPalCaptureMock).toHaveBeenCalledWith('CAPTURE123');
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refund_pending',
      paypalRefundId: 'REFUND123',
    });
    expect(sendFailedCapacityRefundCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it('records an immediately completed capacity refund', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'COMPLETED',
    });

    await expect(finalizePaidCapture(capture)).resolves.toMatchObject({
      status: 'capacity_unavailable',
      paymentStatus: 'refunded',
    });
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refunded',
      paypalRefundId: 'REFUND123',
    });
    expect(sendFailedCapacityRefundCommunicationMock).toHaveBeenCalledOnce();
  });

  it('records and communicates a failed capacity refund response', async () => {
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'FAILED',
    });

    await expect(finalizePaidCapture(capture)).resolves.toMatchObject({
      status: 'capacity_unavailable',
      paymentStatus: 'refund_failed',
    });
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refund_failed',
      paypalRefundId: 'REFUND123',
    });
    expect(sendRefundFailedCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
    expect(sendFailedCapacityRefundCommunicationMock).not.toHaveBeenCalled();
  });

  it('marks a failed refund and rethrows the PayPal error', async () => {
    const refundError = new Error('PayPal refund failed');
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundPayPalCaptureMock.mockRejectedValueOnce(refundError);

    await expect(finalizePaidCapture(capture)).rejects.toThrow(refundError);
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refund_failed',
    });
    expect(sendFailedCapacityRefundCommunicationMock).not.toHaveBeenCalled();
    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it('propagates a refund status mutation failure without marking the refund failed', async () => {
    const mutationError = new Error('Convex unavailable');
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    refundPayPalCaptureMock.mockResolvedValueOnce({
      id: 'REFUND123',
      status: 'PENDING',
    });
    updateCheckoutAttemptRefundStatusMock.mockRejectedValueOnce(mutationError);

    await expect(finalizePaidCapture(capture)).rejects.toThrow(mutationError);
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledOnce();
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refund_pending',
      paypalRefundId: 'REFUND123',
    });
    expect(sendFailedCapacityRefundCommunicationMock).not.toHaveBeenCalled();
  });

  it('propagates completion mutation failures', async () => {
    const mutationError = new Error('Checkout amount mismatch');
    completeCheckoutAttemptMock.mockRejectedValueOnce(mutationError);

    await expect(finalizePaidCapture(capture)).rejects.toThrow(mutationError);
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(refundPayPalCaptureMock).not.toHaveBeenCalled();
  });
});
