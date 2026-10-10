import {
  completeCheckoutAttempt,
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

export async function finalizePaidCapture({
  paypalOrderId,
  paypalCaptureId,
  amountValue,
  currency,
}: {
  paypalOrderId: string;
  paypalCaptureId: string;
  amountValue: string;
  currency: string;
}) {
  const bookingAccessToken = generateCheckoutAccessToken();
  const result = await completeCheckoutAttempt({
    paypalOrderId,
    amountValue,
    currency,
    paypalCaptureId,
    bookingAccessTokenHash: hashCheckoutAccessToken(bookingAccessToken),
  });

  logEvent(result.status === 'booking_created' ? 'booking.created' : 'checkout.finalized', {
    paypalOrderId,
    paypalCaptureId,
    status: result.status,
    checkoutAttemptId:
      'checkoutAttempt' in result
        ? result.checkoutAttempt?._id
        : 'checkoutAttemptId' in result
          ? result.checkoutAttemptId
          : undefined,
    bookingId: 'bookingId' in result ? result.bookingId : undefined,
  });

  if (result.status === 'booking_created') {
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
  }

  if (result.status === 'capacity_unavailable') {
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

    return { ...result, paymentStatus };
  }

  return result;
}
