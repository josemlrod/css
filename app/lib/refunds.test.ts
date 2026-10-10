import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordBookingRefund } from './bookings';
import { updateCheckoutAttemptRefundStatus } from './checkout-attempts';
import {
  sendBookingCancellationRefundFailedCommunication,
  sendBookingCancellationRefundRequestedCommunication,
  sendFailedCapacityRefundCommunication,
  sendOperatorNotification,
  sendRefundFailedCommunication,
} from './email';
import { refundPayPalCapture } from './paypal';
import { refundBooking, refundCheckoutAttempt } from './refunds';

vi.mock('./bookings', () => ({ recordBookingRefund: vi.fn() }));
vi.mock('./checkout-attempts', () => ({ updateCheckoutAttemptRefundStatus: vi.fn() }));
vi.mock('./email', () => ({
  sendBookingCancellationRefundFailedCommunication: vi.fn(),
  sendBookingCancellationRefundRequestedCommunication: vi.fn(),
  sendFailedCapacityRefundCommunication: vi.fn(),
  sendOperatorNotification: vi.fn(),
  sendRefundFailedCommunication: vi.fn(),
}));
vi.mock('./paypal', () => ({ refundPayPalCapture: vi.fn() }));

const paypal = vi.mocked(refundPayPalCapture);
const notifyOperator = vi.mocked(sendOperatorNotification);

const details = {
  bookerEmail: 'booker@example.com',
  bookerName: 'Test Booker',
  date: '2099-07-04',
  time: '10:00 AM',
  guests: 2,
};
const paid = {
  ...details,
  _id: 'booking_1',
  cancelled: null as number | null,
  paymentStatus: 'paid',
  paypalCaptureId: 'CAPTURE1',
  paypalRefundId: undefined as string | undefined,
};
const failed = { ...paid, cancelled: 1, paymentStatus: 'refund_failed', paypalRefundId: 'REFUND_OLD' };
const tour = { name: 'Savannah Food Tour' };
const communication = {
  to: 'booker@example.com',
  bookerName: 'Test Booker',
  tourName: 'Savannah Food Tour',
  date: '2099-07-04',
  time: '10:00 AM',
  guests: 2,
  total: 150,
};

function refund(
  booking: object,
  by: 'booker' | 'operator' = 'booker',
  attempt: 'first' | 'retry' = 'first',
) {
  return refundBooking({ booking: booking as never, tour, total: 150, by, attempt });
}

function rejectWith(status: string) {
  if (status === 'error') paypal.mockRejectedValueOnce(new Error('PayPal down'));
  else paypal.mockResolvedValueOnce({ id: 'REFUND1', status });
}

describe('refundBooking', () => {
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['a paid Booking retried', paid, 'retry'],
    ['a failed refund refunded again from scratch', failed, 'first'],
    ['a Booking without a capture', { ...paid, paypalCaptureId: undefined }, 'first'],
  ] as const)('does not refund %s', async (_, booking, attempt) => {
    await expect(refund(booking, 'operator', attempt)).resolves.toBe('not_refundable');
    expect(paypal).not.toHaveBeenCalled();
  });

  it('cancels a Booking after PayPal accepts the refund, then tells the Booker and operator', async () => {
    paypal.mockResolvedValueOnce({ id: 'REFUND1', status: 'PENDING' });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(refund(paid)).resolves.toBe('refund_requested');
    expect(paypal).toHaveBeenCalledWith('CAPTURE1', undefined);
    expect(recordBookingRefund).toHaveBeenCalledWith({
      id: 'booking_1',
      attempt: 'first',
      paypalRefundId: 'REFUND1',
    });
    expect(sendBookingCancellationRefundRequestedCommunication).toHaveBeenCalledWith(
      communication,
      { bookingId: 'booking_1' },
    );
    expect(notifyOperator).toHaveBeenCalledOnce();
    expect(notifyOperator).toHaveBeenCalledWith('booker_canceled', communication, {
      bookingId: 'booking_1',
    });
  });

  it('retries a failed refund with a new PayPal request ID and no operator email', async () => {
    paypal.mockResolvedValueOnce({ id: 'REFUND2', status: 'COMPLETED' });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(refund(failed, 'operator', 'retry')).resolves.toBe('refund_requested');
    expect(paypal).toHaveBeenCalledWith('CAPTURE1', 'refund-CAPTURE1-REFUND_OLD');
    expect(recordBookingRefund).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 'retry', paypalRefundId: 'REFUND2' }),
    );
    expect(sendBookingCancellationRefundRequestedCommunication).toHaveBeenCalledOnce();
    expect(notifyOperator).not.toHaveBeenCalled();
  });

  it.each([
    ['booker', 'FAILED', 1],
    ['booker', 'error', 1],
    ['operator', 'CANCELLED', 0],
  ] as const)(
    'leaves the Booking unchanged when a %s refund gets %s',
    async (by, status, failureEmails) => {
      rejectWith(status);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(refund(paid, by)).resolves.toBe('refund_failed');
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({
        event: 'refund.failed',
        bookingId: 'booking_1',
        requestedBy: by,
      });
      expect(recordBookingRefund).not.toHaveBeenCalled();
      expect(sendBookingCancellationRefundRequestedCommunication).not.toHaveBeenCalled();
      expect(sendBookingCancellationRefundFailedCommunication).toHaveBeenCalledTimes(
        failureEmails,
      );
    },
  );

  it.each(['booker', 'operator'] as const)(
    'tells the operator when PayPal took a %s refund but the Booking did not save',
    async (by) => {
      paypal.mockResolvedValueOnce({ id: 'REFUND1', status: 'PENDING' });
      vi.mocked(recordBookingRefund).mockRejectedValueOnce(new Error('Convex down'));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(refund(paid, by)).resolves.toBe('record_failed');
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({
        event: 'refund.record_failed',
        paypalRefundId: 'REFUND1',
      });
      expect(sendBookingCancellationRefundRequestedCommunication).toHaveBeenCalledOnce();
      expect(notifyOperator).toHaveBeenCalledWith('refund_record_failed', communication, {
        bookingId: 'booking_1',
      });
    },
  );
});

describe('refundCheckoutAttempt', () => {
  afterEach(() => vi.clearAllMocks());

  const checkoutAttempt = { ...details, _id: 'attempt_1', total: 150 };
  const record = { checkoutAttemptId: 'attempt_1' };
  const refundAttempt = () =>
    refundCheckoutAttempt({
      checkoutAttempt: checkoutAttempt as never,
      tour,
      paypalCaptureId: 'CAPTURE1',
    });

  it.each([
    ['PENDING', 'refund_pending', 'REFUND1'],
    ['COMPLETED', 'refunded', 'REFUND1'],
    ['FAILED', 'refund_failed', 'REFUND1'],
    ['error', 'refund_failed', undefined],
  ])('records a %s capacity refund as %s', async (status, paymentStatus, paypalRefundId) => {
    rejectWith(status);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(refundAttempt()).resolves.toBe(paymentStatus);
    expect(paypal).toHaveBeenCalledWith('CAPTURE1', undefined);
    expect(updateCheckoutAttemptRefundStatus).toHaveBeenCalledWith({
      id: 'attempt_1',
      paymentStatus,
      paypalRefundId,
    });
    const [sent, skipped] =
      paymentStatus === 'refund_failed'
        ? [sendRefundFailedCommunication, sendFailedCapacityRefundCommunication]
        : [sendFailedCapacityRefundCommunication, sendRefundFailedCommunication];
    expect(sent).toHaveBeenCalledWith(communication, record);
    expect(skipped).not.toHaveBeenCalled();
    expect(notifyOperator).not.toHaveBeenCalled();
  });

  it('still tells the Booker and alerts the operator when the refund does not save', async () => {
    paypal.mockResolvedValueOnce({ id: 'REFUND1', status: 'PENDING' });
    vi.mocked(updateCheckoutAttemptRefundStatus).mockRejectedValueOnce(new Error('Convex down'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(refundAttempt()).resolves.toBe('refund_pending');
    expect(sendFailedCapacityRefundCommunication).toHaveBeenCalledWith(communication, record);
    expect(notifyOperator).toHaveBeenCalledWith('refund_record_failed', communication, record);
  });
});
