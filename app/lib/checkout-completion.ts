import {
  completeCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from './checkout-attempts';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
  sendRefundFailedCommunication,
} from './email';
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

  if (result.status === 'booking_created') {
    const manageUrl = manageBookingUrl(result.bookingId, bookingAccessToken);

    await sendBookingCommunication({
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
    });
  }

  if (result.status === 'capacity_unavailable') {
    let refund: Awaited<ReturnType<typeof refundPayPalCapture>>;

    try {
      refund = await refundPayPalCapture(paypalCaptureId);
    } catch (refundError) {
      await updateCheckoutAttemptRefundStatus({
        id: result.checkoutAttempt._id,
        paymentStatus: 'refund_failed',
      });
      throw refundError;
    }

    const paymentStatus = refundPaymentStatus(refund.status);

    await updateCheckoutAttemptRefundStatus({
      id: result.checkoutAttempt._id,
      paymentStatus,
      paypalRefundId: refund.id,
    });

    const communication = {
      to: result.checkoutAttempt.bookerEmail,
      bookerName: result.checkoutAttempt.bookerName,
      tourName: result.tour.name,
      date: result.checkoutAttempt.date,
      time: result.checkoutAttempt.time,
      guests: result.checkoutAttempt.guests,
      total: result.checkoutAttempt.total,
    };

    if (paymentStatus === 'refund_failed') {
      await sendRefundFailedCommunication(communication);
    } else {
      await sendFailedCapacityRefundCommunication(communication);
    }

    return { ...result, paymentStatus };
  }

  return result;
}
