import {
  completeCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from './checkout-attempts';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
} from './email';
import { refundPayPalCapture } from './paypal';

function manageBookingUrl(bookingId: string, accessToken: string) {
  const origin = process.env.APP_ORIGIN;

  if (!origin) throw new Error('APP_ORIGIN is required');

  return new URL(`/manage/${bookingId}?token=${accessToken}`, origin).toString();
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

    await updateCheckoutAttemptRefundStatus({
      id: result.checkoutAttempt._id,
      paymentStatus: 'refund_pending',
      paypalRefundId: refund.id,
    });

    await sendFailedCapacityRefundCommunication({
      to: result.checkoutAttempt.bookerEmail,
      bookerName: result.checkoutAttempt.bookerName,
      tourName: result.tour.name,
      date: result.checkoutAttempt.date,
      time: result.checkoutAttempt.time,
      guests: result.checkoutAttempt.guests,
      total: result.checkoutAttempt.total,
    });
  }

  return result;
}
