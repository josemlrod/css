import { afterEach, describe, expect, it, vi } from 'vitest';

import { convexMutation } from './convex.server';
import { convexCalls } from './convex.test-helpers';
import { sendBookingCommunication, sendOperatorNotification } from './email';
import { refundPayPalCapture } from './paypal';
import { refundBooking, refundCheckoutAttempt } from './refunds';

vi.mock('./convex.server', () => ({ convexMutation: vi.fn() }));
vi.mock('./email', () => ({
  sendBookingCommunication: vi.fn(),
  sendOperatorNotification: vi.fn(),
}));
vi.mock('./paypal', () => ({ refundPayPalCapture: vi.fn() }));

const mutation = vi.mocked(convexMutation);
const paypal = vi.mocked(refundPayPalCapture);
const notifyBooker = vi.mocked(sendBookingCommunication);
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
    expect(convexCalls(mutation)).toEqual([
      ['bookings:recordBookingRefund', { id: 'booking_1', attempt: 'first', paypalRefundId: 'REFUND1' }],
    ]);
    const records = { booking: paid, tour, total: 150 };
    expect(notifyBooker).toHaveBeenCalledWith('cancellation_refund_requested', records);
    expect(notifyOperator).toHaveBeenCalledOnce();
    expect(notifyOperator).toHaveBeenCalledWith('booker_canceled', records);
  });

  it('retries a failed refund with a new PayPal request ID and no operator email', async () => {
    paypal.mockResolvedValueOnce({ id: 'REFUND2', status: 'COMPLETED' });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(refund(failed, 'operator', 'retry')).resolves.toBe('refund_requested');
    expect(paypal).toHaveBeenCalledWith('CAPTURE1', 'refund-CAPTURE1-REFUND_OLD');
    expect(mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ attempt: 'retry', paypalRefundId: 'REFUND2' }),
    );
    expect(notifyBooker).toHaveBeenCalledWith('cancellation_refund_requested', expect.anything());
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
      expect(mutation).not.toHaveBeenCalled();
      expect(notifyBooker.mock.calls).toEqual(
        failureEmails
          ? [['cancellation_refund_failed', { booking: paid, tour, total: 150 }]]
          : [],
      );
    },
  );

  it.each(['booker', 'operator'] as const)(
    'tells the operator when PayPal took a %s refund but the Booking did not save',
    async (by) => {
      paypal.mockResolvedValueOnce({ id: 'REFUND1', status: 'PENDING' });
      mutation.mockRejectedValueOnce(new Error('Convex down'));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(refund(paid, by)).resolves.toBe('record_failed');
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({
        event: 'refund.record_failed',
        paypalRefundId: 'REFUND1',
      });
      expect(notifyBooker).toHaveBeenCalledWith('cancellation_refund_requested', expect.anything());
      expect(notifyOperator).toHaveBeenCalledWith('refund_record_failed', {
        booking: paid,
        tour,
        total: 150,
      });
    },
  );
});

describe('refundCheckoutAttempt', () => {
  afterEach(() => vi.clearAllMocks());

  const checkoutAttempt = { ...details, _id: 'attempt_1', total: 150 };
  const records = { checkoutAttempt, tour };
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
    expect(convexCalls(mutation)).toEqual([
      ['checkoutAttempts:updateCheckoutAttemptRefundStatus', { id: 'attempt_1', paymentStatus, paypalRefundId }],
    ]);
    expect(notifyBooker.mock.calls).toEqual([
      [paymentStatus === 'refund_failed' ? 'refund_failed' : 'capacity_refund', records],
    ]);
    expect(notifyOperator).not.toHaveBeenCalled();
  });

  it('still tells the Booker and alerts the operator when the refund does not save', async () => {
    paypal.mockResolvedValueOnce({ id: 'REFUND1', status: 'PENDING' });
    mutation.mockRejectedValueOnce(new Error('Convex down'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(refundAttempt()).resolves.toBe('refund_pending');
    expect(notifyBooker).toHaveBeenCalledWith('capacity_refund', records);
    expect(notifyOperator).toHaveBeenCalledWith('refund_record_failed', records);
  });
});
