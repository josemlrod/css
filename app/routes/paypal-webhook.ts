import { data } from 'react-router';

import {
  expireCheckoutAttempt,
  failCheckoutAttempt,
  updateRefundStatusByPayPalRefund,
} from '~/lib/checkout-attempts';
import { finalizePaidCapture } from '~/lib/checkout-completion';
import { sendRefundFailedCommunication } from '~/lib/email';
import { verifyPayPalWebhook } from '~/lib/paypal';

import type { Route } from './+types/paypal-webhook';

type PayPalWebhookEvent = {
  event_type?: unknown;
  resource?: {
    id?: unknown;
    order_id?: unknown;
    amount?: {
      value?: unknown;
      currency_code?: unknown;
    };
    supplementary_data?: {
      related_ids?: { order_id?: unknown };
    };
  };
};

function stringField(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function processRefundFailure(paypalRefundId: string) {
  const result = await updateRefundStatusByPayPalRefund({
    paypalRefundId,
    paymentStatus: 'refund_failed',
  });

  if (result.status === 'updated_booking' && result.tour) {
    await sendRefundFailedCommunication({
      to: result.booking.bookerEmail,
      bookerName: result.booking.bookerName,
      tourName: result.tour.name,
      date: result.booking.date,
      time: result.booking.time,
      guests: result.booking.guests,
      total: result.tour.price * result.booking.guests,
    });
  }

  if (result.status === 'updated_checkout_attempt' && result.tour) {
    await sendRefundFailedCommunication({
      to: result.checkoutAttempt.bookerEmail,
      bookerName: result.checkoutAttempt.bookerName,
      tourName: result.tour.name,
      date: result.checkoutAttempt.date,
      time: result.checkoutAttempt.time,
      guests: result.checkoutAttempt.guests,
      total: result.checkoutAttempt.total,
    });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const rawBody = await request.text();
  let event: PayPalWebhookEvent;

  try {
    event = (await verifyPayPalWebhook({
      headers: request.headers,
      rawBody,
    })) as PayPalWebhookEvent;
  } catch (error) {
    console.error(error);
    return data(
      { ok: false, error: 'Invalid PayPal webhook' },
      { status: 400 },
    );
  }

  try {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const paypalOrderId = stringField(
          event.resource?.supplementary_data?.related_ids?.order_id,
        );
        const paypalCaptureId = stringField(event.resource?.id);
        const amountValue = stringField(event.resource?.amount?.value);
        const currency = stringField(event.resource?.amount?.currency_code);

        if (!paypalOrderId || !paypalCaptureId || !amountValue || !currency) {
          return data(
            { ok: false, error: 'Invalid Checkout Session' },
            { status: 400 },
          );
        }

        await finalizePaidCapture({
          paypalOrderId,
          paypalCaptureId,
          amountValue,
          currency,
        });
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const paypalOrderId = stringField(
          event.resource?.supplementary_data?.related_ids?.order_id,
        );

        if (!paypalOrderId) {
          throw new Error('PayPal capture is missing its Order ID');
        }

        await failCheckoutAttempt({ paypalOrderId });
        break;
      }
      case 'CHECKOUT.PAYMENT-APPROVAL.REVERSED': {
        const paypalOrderId = stringField(event.resource?.order_id);

        if (!paypalOrderId) {
          throw new Error('Reversed approval is missing its Order ID');
        }

        await expireCheckoutAttempt({ paypalOrderId });
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const paypalRefundId = stringField(event.resource?.id);

        if (!paypalRefundId) {
          throw new Error('PayPal refund is missing its Refund ID');
        }

        await updateRefundStatusByPayPalRefund({
          paypalRefundId,
          paymentStatus: 'refunded',
        });
        break;
      }
      case 'PAYMENT.REFUND.FAILED': {
        const paypalRefundId = stringField(event.resource?.id);

        if (!paypalRefundId) {
          throw new Error('PayPal refund is missing its Refund ID');
        }

        await processRefundFailure(paypalRefundId);
        break;
      }
    }
  } catch (error) {
    console.error(error);
    return data(
      { ok: false, error: 'Unable to process PayPal event' },
      { status: 400 },
    );
  }

  return { ok: true };
}
