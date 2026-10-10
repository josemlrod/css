import { data } from 'react-router';

import {
  expireCheckoutAttempt,
  updateRefundStatusByPayPalRefund,
} from '~/lib/checkout-attempts';
import { completeCapture } from '~/lib/checkout-completion';
import { sendBookingCommunication } from '~/lib/email';
import { logError, logEvent } from '~/lib/log';
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
    const { booking, tour, total } = result;

    await sendBookingCommunication('refund_failed', { booking, tour, total });
  }

  if (result.status === 'updated_checkout_attempt' && result.tour) {
    const { checkoutAttempt, tour } = result;

    await sendBookingCommunication('refund_failed', { checkoutAttempt, tour });
  }

  return result;
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
    logError('paypal.webhook_rejected', error);
    return data(
      { ok: false, error: 'Invalid PayPal webhook' },
      { status: 400 },
    );
  }

  const eventDetails = {
    eventType: event.event_type,
    resourceId: event.resource?.id,
    paypalOrderId:
      event.resource?.supplementary_data?.related_ids?.order_id ??
      event.resource?.order_id,
  };

  logEvent('paypal.webhook_received', eventDetails);

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
          logEvent('paypal.webhook_ignored', {
            ...eventDetails,
            reason: 'missing_capture_fields',
          });
          return data(
            { ok: false, error: 'Invalid Checkout Session' },
            { status: 400 },
          );
        }

        await completeCapture({
          status: 'COMPLETED',
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

        await completeCapture({ status: 'DECLINED', paypalOrderId });
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

        const result = await updateRefundStatusByPayPalRefund({
          paypalRefundId,
          paymentStatus: 'refunded',
        });

        logEvent('refund.reconciled', {
          paypalRefundId,
          paymentStatus: 'refunded',
          result: result.status,
        });

        if (result.status === 'not_found') {
          return data(
            { ok: false, error: 'PayPal refund is not ready for reconciliation' },
            { status: 503 },
          );
        }
        break;
      }
      case 'PAYMENT.REFUND.FAILED': {
        const paypalRefundId = stringField(event.resource?.id);

        if (!paypalRefundId) {
          throw new Error('PayPal refund is missing its Refund ID');
        }

        const result = await processRefundFailure(paypalRefundId);

        logEvent('refund.reconciled', {
          paypalRefundId,
          paymentStatus: 'refund_failed',
          result: result.status,
        });

        if (result.status === 'not_found') {
          return data(
            { ok: false, error: 'PayPal refund is not ready for reconciliation' },
            { status: 503 },
          );
        }
        break;
      }
    }
  } catch (error) {
    logError('paypal.webhook_failed', error, eventDetails);
    return data(
      { ok: false, error: 'Unable to process PayPal event' },
      { status: 400 },
    );
  }

  return { ok: true };
}
