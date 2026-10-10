import {
  completeCheckoutAttempt,
  failCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from './checkout-attempts';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
  sendOperatorNotification,
  sendRefundFailedCommunication,
} from './email';
import { logError, logEvent } from './log';
import { refundPayPalCapture } from './paypal';
import type { CheckoutAttempt } from './types';

function manageBookingUrl(bookingId: string, accessToken: string) {
  const origin = process.env.APP_ORIGIN;

  if (!origin) throw new Error('APP_ORIGIN is required');

  return new URL(`/manage/${bookingId}?token=${accessToken}`, origin).toString();
}

function refundPaymentStatus(status: string) {
  if (status === 'COMPLETED') return 'refunded' as const;
  if (status === 'FAILED' || status === 'CANCELLED') {
    return 'refund_failed' as const;
  }

  return 'refund_pending' as const;
}

type CompletedCheckout = Awaited<ReturnType<typeof completeCheckoutAttempt>>;
type CapacityUnavailableCheckout = Extract<
  CompletedCheckout,
  { status: 'capacity_unavailable' }
>;
type PaymentStatus = CheckoutAttempt['paymentStatus'];

type CapturePayment = {
  paypalCaptureId: string;
  amountValue: string;
  currency: string;
};
type CompletedPayPalCapture = CapturePayment & {
  status: 'COMPLETED';
  paypalOrderId: string;
};

// PayPal capture statuses are open-ended; only a COMPLETED capture must carry its payment.
export type PayPalCapture =
  | CompletedPayPalCapture
  | (Partial<CapturePayment> & { status: string; paypalOrderId: string });

function isCompleted(capture: PayPalCapture): capture is CompletedPayPalCapture {
  return capture.status === 'COMPLETED';
}

async function refundUnavailableCapacity(
  result: CapacityUnavailableCheckout,
  paypalCaptureId: string,
) {
  const communication = {
    to: result.checkoutAttempt.bookerEmail,
    bookerName: result.checkoutAttempt.bookerName,
    tourName: result.tour.name,
    date: result.checkoutAttempt.date,
    time: result.checkoutAttempt.time,
    guests: result.checkoutAttempt.guests,
    total: result.checkoutAttempt.total,
  };
  const record = { checkoutAttemptId: result.checkoutAttempt._id };
  let refund: Awaited<ReturnType<typeof refundPayPalCapture>>;

  try {
    refund = await refundPayPalCapture(paypalCaptureId);
  } catch (refundError) {
    logError('refund.failed', refundError, {
      checkoutAttemptId: result.checkoutAttempt._id,
      paypalCaptureId,
      reason: 'capacity_unavailable',
    });
    await updateCheckoutAttemptRefundStatus({
      id: result.checkoutAttempt._id,
      paymentStatus: 'refund_failed',
    });
    await sendOperatorNotification('refund_failed', communication, record);
    throw refundError;
  }

  const paymentStatus = refundPaymentStatus(refund.status);

  logEvent('refund.requested', {
    checkoutAttemptId: result.checkoutAttempt._id,
    paypalCaptureId,
    paypalRefundId: refund.id,
    refundStatus: refund.status,
    reason: 'capacity_unavailable',
  });

  await updateCheckoutAttemptRefundStatus({
    id: result.checkoutAttempt._id,
    paymentStatus,
    paypalRefundId: refund.id,
  });

  if (paymentStatus === 'refund_failed') {
    await sendRefundFailedCommunication(communication, record);
  } else {
    await sendFailedCapacityRefundCommunication(communication, record);
  }

  return paymentStatus;
}

async function finalizePaidCapture({
  paypalOrderId,
  paypalCaptureId,
  amountValue,
  currency,
}: CompletedPayPalCapture): Promise<PaymentStatus> {
  const bookingAccessToken = generateCheckoutAccessToken();
  const result = await completeCheckoutAttempt({
    paypalOrderId,
    amountValue,
    currency,
    paypalCaptureId,
    bookingAccessTokenHash: hashCheckoutAccessToken(bookingAccessToken),
  });
  const logFields = { paypalOrderId, paypalCaptureId, status: result.status };

  switch (result.status) {
    case 'booking_created': {
      logEvent('booking.created', {
        ...logFields,
        checkoutAttemptId: result.checkoutAttempt._id,
        bookingId: result.bookingId,
      });

      const manageUrl = manageBookingUrl(result.bookingId, bookingAccessToken);

      await sendBookingCommunication(
        {
          to: result.checkoutAttempt.bookerEmail,
          bookerName: result.checkoutAttempt.bookerName,
          tourName: result.tour.name,
          date: result.checkoutAttempt.date,
          time: result.checkoutAttempt.time,
          guests: result.checkoutAttempt.guests,
          total: result.checkoutAttempt.total,
          meetingPoint: result.tour.meetingPoint,
          editUrl: manageUrl,
          cancelUrl: manageUrl,
        },
        { bookingId: result.bookingId },
      );
      return 'paid';
    }
    case 'booking_exists':
      logEvent('checkout.finalized', { ...logFields, bookingId: result.bookingId });
      return 'paid';
    case 'capacity_unavailable':
      logEvent('checkout.finalized', {
        ...logFields,
        checkoutAttemptId: result.checkoutAttempt._id,
      });
      return refundUnavailableCapacity(result, paypalCaptureId);
    default:
      logEvent('checkout.finalized', {
        ...logFields,
        checkoutAttemptId: result.checkoutAttemptId,
      });
      return result.status;
  }
}

// The one place a PayPal capture becomes a Payment Status. The capture route and the
// webhook only translate their input into a capture; per ADR 0002, only a COMPLETED
// capture can create a Booking, and a PENDING capture waits for the webhook.
export async function completeCapture(capture: PayPalCapture): Promise<PaymentStatus> {
  if (isCompleted(capture)) return finalizePaidCapture(capture);

  switch (capture.status) {
    case 'PENDING':
      return 'pending';
    case 'DECLINED':
    case 'FAILED':
      await failCheckoutAttempt({ paypalOrderId: capture.paypalOrderId });
      return 'failed';
    default:
      throw new Error(`Unsupported PayPal capture status: ${capture.status}`);
  }
}
