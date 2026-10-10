import { data } from 'react-router';

import { verifyAccessToken } from '~/lib/access-tokens';
import { completeCapture } from '~/lib/checkout-completion';
import { convexQuery } from '~/lib/convex.server';
import { logError, logEvent } from '~/lib/log';
import { capturePayPalOrder } from '~/lib/paypal';
import type { CheckoutAttemptId } from '~/lib/types';

import { api } from '../../convex/_generated/api';
import type { Route } from './+types/paypal-capture';

export async function action({ params, request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data(
      { ok: false, error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

  const checkoutAttemptId = params.checkoutAttemptId as CheckoutAttemptId;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const checkoutAttempt = await convexQuery(api.checkoutAttempts.getCheckoutAttemptById, {
    checkoutAttemptId,
  });

  if (
    !checkoutAttempt ||
    !verifyAccessToken(token, checkoutAttempt.accessTokenHash)
  ) {
    logEvent('checkout.capture_rejected', { checkoutAttemptId, reason: 'not_found' });
    return data({ ok: false, error: 'Checkout not found' }, { status: 404 });
  }

  let orderId: unknown;

  try {
    ({ orderId } = (await request.json()) as { orderId?: unknown });
  } catch {
    logEvent('checkout.capture_rejected', { checkoutAttemptId, reason: 'invalid_body' });
    return data({ ok: false, error: 'Invalid PayPal order' }, { status: 400 });
  }

  // The Booker approved in PayPal and the browser asked us to take the payment.
  logEvent('checkout.capture_requested', {
    checkoutAttemptId,
    paypalOrderId: orderId,
    paymentStatus: checkoutAttempt.paymentStatus,
  });

  if (typeof orderId !== 'string' || orderId !== checkoutAttempt.paypalOrderId) {
    logEvent('checkout.capture_rejected', {
      checkoutAttemptId,
      reason: 'order_mismatch',
      expectedPaypalOrderId: checkoutAttempt.paypalOrderId,
    });
    return data({ ok: false, error: 'Invalid PayPal order' }, { status: 400 });
  }

  if (checkoutAttempt.paymentStatus !== 'pending') {
    return data({
      ok: true,
      status: checkoutAttempt.paymentStatus,
      checkoutAttemptId,
    });
  }

  if (checkoutAttempt.expiresAt <= Date.now()) {
    logEvent('checkout.capture_rejected', {
      checkoutAttemptId,
      reason: 'expired',
      expiresAt: new Date(checkoutAttempt.expiresAt).toISOString(),
    });
    return data(
      {
        ok: false,
        status: 'expired',
        error: 'Checkout expired',
        checkoutAttemptId,
      },
      { status: 409 },
    );
  }

  try {
    const capture = await capturePayPalOrder(orderId);

    logEvent('checkout.captured', {
      checkoutAttemptId,
      paypalOrderId: orderId,
      paypalCaptureId: capture.id,
      captureStatus: capture.status,
      amount: capture.amount.value,
      currency: capture.amount.currency_code,
    });

    const status = await completeCapture({
      status: capture.status,
      paypalOrderId: orderId,
      paypalCaptureId: capture.id,
      amountValue: capture.amount.value,
      currency: capture.amount.currency_code,
    });

    return data({ ok: status !== 'failed', status, checkoutAttemptId });
  } catch (error) {
    logError('checkout.capture_failed', error, {
      checkoutAttemptId,
      paypalOrderId: orderId,
    });
    return data(
      { ok: false, error: 'Unable to complete payment' },
      { status: 500 },
    );
  }
}
