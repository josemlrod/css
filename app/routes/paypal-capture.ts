import { data } from 'react-router';

import {
  getCheckoutAttempt,
  updateCheckoutAttempt,
  verifyCheckoutAccessToken,
} from '~/lib/checkout-attempts';
import { finalizePaidCapture } from '~/lib/checkout-completion';
import { capturePayPalOrder } from '~/lib/paypal';
import type { CheckoutAttemptId } from '~/lib/types';

import type { Route } from './+types/paypal-capture';

function completedPaymentStatus(
  result: Awaited<ReturnType<typeof finalizePaidCapture>>,
) {
  if (result.status === 'booking_created' || result.status === 'booking_exists') {
    return 'paid';
  }
  if (result.status === 'capacity_unavailable') return 'refund_pending';

  return result.status;
}

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data(
      { ok: false, error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

  const checkoutAttemptId = params.checkoutAttemptId as CheckoutAttemptId;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const checkoutAttempt = await getCheckoutAttempt(checkoutAttemptId);

  if (
    !checkoutAttempt ||
    !verifyCheckoutAccessToken(token, checkoutAttempt.accessTokenHash)
  ) {
    return data({ ok: false, error: 'Checkout not found' }, { status: 404 });
  }

  let orderId: unknown;

  try {
    ({ orderId } = (await request.json()) as { orderId?: unknown });
  } catch {
    return data({ ok: false, error: 'Invalid PayPal order' }, { status: 400 });
  }

  if (typeof orderId !== 'string' || orderId !== checkoutAttempt.paypalOrderId) {
    return data({ ok: false, error: 'Invalid PayPal order' }, { status: 400 });
  }

  if (checkoutAttempt.paymentStatus !== 'pending') {
    return data({
      ok: true,
      status: checkoutAttempt.paymentStatus,
      checkoutAttemptId,
    });
  }

  try {
    const capture = await capturePayPalOrder(orderId);

    if (capture.status === 'COMPLETED') {
      const result = await finalizePaidCapture({
        paypalOrderId: orderId,
        paypalCaptureId: capture.id,
        amountValue: capture.amount.value,
        currency: capture.amount.currency_code,
      });

      return data({
        ok: true,
        status: completedPaymentStatus(result),
        checkoutAttemptId,
      });
    }

    if (capture.status === 'PENDING') {
      return data({ ok: true, status: 'pending', checkoutAttemptId });
    }

    if (capture.status === 'DECLINED' || capture.status === 'FAILED') {
      await updateCheckoutAttempt({ id: checkoutAttemptId, paymentStatus: 'failed' });
      return data({ ok: false, status: 'failed', checkoutAttemptId });
    }

    throw new Error(`Unsupported PayPal capture status: ${capture.status}`);
  } catch (error) {
    console.error(error);
    return data(
      { ok: false, error: 'Unable to complete payment' },
      { status: 500 },
    );
  }
}
