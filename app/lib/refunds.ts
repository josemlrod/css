import { api } from '../../convex/_generated/api';
import { bookingRefundAttempt } from '../../convex/lib/bookings';
import { convexMutation } from './convex.server';
import { sendBookingCommunication, sendOperatorNotification } from './email';
import { logError, logEvent } from './log';
import { refundPayPalCapture } from './paypal';
import type { Booking, CheckoutAttempt, Tour } from './types';

type Details = Record<string, unknown>;
type Refund =
  | { paymentStatus: 'refund_pending' | 'refunded'; paypalRefundId: string }
  | { paymentStatus: 'refund_failed'; paypalRefundId?: string };

// The one place a PayPal refund response becomes a Payment Status. A refund PayPal
// wouldn't take, by error or by status, has failed.
async function requestRefund(
  captureId: string,
  requestId: string | undefined,
  details: Details,
): Promise<Refund> {
  let refund: Awaited<ReturnType<typeof refundPayPalCapture>>;

  try {
    refund = await refundPayPalCapture(captureId, requestId);
  } catch (error) {
    logError('refund.failed', error, details);
    return { paymentStatus: 'refund_failed' };
  }

  const fields = { ...details, paypalRefundId: refund.id, refundStatus: refund.status };

  if (refund.status === 'FAILED' || refund.status === 'CANCELLED') {
    logError('refund.failed', new Error(`PayPal refund returned ${refund.status}`), fields);
    return { paymentStatus: 'refund_failed', paypalRefundId: refund.id };
  }

  logEvent('refund.requested', fields);

  return {
    paymentStatus: refund.status === 'COMPLETED' ? 'refunded' : 'refund_pending',
    paypalRefundId: refund.id,
  };
}

// PayPal already took the refund, so a failed save can't undo it. The Booker still hears
// about the refund and the operator is told to fix the record.
async function saveRefund(save: () => Promise<unknown>, details: Details) {
  try {
    await save();
    return true;
  } catch (error) {
    logError('refund.record_failed', error, details);
    return false;
  }
}

export type BookingRefundOutcome =
  | 'refund_requested'
  | 'not_refundable'
  | 'refund_failed'
  | 'record_failed';

// Cancels a paid Booking with a full refund, or retries a refund PayPal rejected. The
// Booking only changes after PayPal accepts the refund.
export async function refundBooking({
  booking,
  tour,
  total,
  by,
  attempt,
}: {
  booking: Omit<Booking, 'accessTokenHash'>;
  tour: Pick<Tour, 'name'>;
  total: number;
  by: 'booker' | 'operator';
  attempt: 'first' | 'retry';
}): Promise<BookingRefundOutcome> {
  const { paypalCaptureId } = booking;

  if (!paypalCaptureId || bookingRefundAttempt(booking) !== attempt) {
    return 'not_refundable';
  }

  const details = { bookingId: booking._id, requestedBy: by, attempt, paypalCaptureId };
  const records = { booking, tour, total };
  const refund = await requestRefund(
    paypalCaptureId,
    // A new request ID per failed refund, so PayPal makes a fresh attempt instead of replaying the failure.
    attempt === 'retry' ? `refund-${paypalCaptureId}-${booking.paypalRefundId}` : undefined,
    details,
  );

  if (refund.paymentStatus === 'refund_failed') {
    // An operator sees the failure in the console; a Booker needs to hear it.
    if (by === 'booker') {
      await sendBookingCommunication('cancellation_refund_failed', records);
    }
    return 'refund_failed';
  }

  const { paypalRefundId } = refund;
  const saved = await saveRefund(
    () =>
      convexMutation(api.bookings.recordBookingRefund, {
        id: booking._id,
        attempt,
        paypalRefundId,
      }),
    { ...details, paypalRefundId },
  );

  await Promise.all([
    sendBookingCommunication('cancellation_refund_requested', records),
    by === 'booker' && sendOperatorNotification('booker_canceled', records),
    !saved && sendOperatorNotification('refund_record_failed', records),
  ]);

  return saved ? 'refund_requested' : 'record_failed';
}

// Refunds a payment that arrived after its time slot filled, so no Booking was made.
export async function refundCheckoutAttempt({
  checkoutAttempt,
  tour,
  paypalCaptureId,
}: {
  checkoutAttempt: CheckoutAttempt;
  tour: Pick<Tour, 'name'>;
  paypalCaptureId: string;
}): Promise<Refund['paymentStatus']> {
  const details = {
    checkoutAttemptId: checkoutAttempt._id,
    reason: 'capacity_unavailable',
    paypalCaptureId,
  };
  const records = { checkoutAttempt, tour };
  const { paymentStatus, paypalRefundId } = await requestRefund(
    paypalCaptureId,
    undefined,
    details,
  );
  const saved = await saveRefund(
    () =>
      convexMutation(api.checkoutAttempts.updateCheckoutAttemptRefundStatus, {
        id: checkoutAttempt._id,
        paymentStatus,
        paypalRefundId,
      }),
    { ...details, paypalRefundId },
  );

  await Promise.all([
    sendBookingCommunication(
      paymentStatus === 'refund_failed' ? 'refund_failed' : 'capacity_refund',
      records,
    ),
    !saved &&
      paymentStatus !== 'refund_failed' &&
      sendOperatorNotification('refund_record_failed', records),
  ]);

  return paymentStatus;
}
