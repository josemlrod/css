import { data } from 'react-router';
import type Stripe from 'stripe';

import {
  completeCheckoutAttempt,
  expireCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from '~/lib/checkout-attempts';
import {
  constructStripeWebhookEvent,
  createRefundForPaymentIntent,
} from '~/lib/stripe';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
} from '~/lib/email';

import type { Route } from './+types/stripe-webhook';

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
}

function manageBookingUrl(bookingId: string, accessToken: string) {
  const origin = process.env.APP_ORIGIN;

  if (!origin) {
    throw new Error('APP_ORIGIN is required');
  }

  return new URL(`/manage/${bookingId}?token=${accessToken}`, origin).toString();
}

export async function action({ request }: Route.ActionArgs) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return data({ ok: false, error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructStripeWebhookEvent(await request.text(), signature);
  } catch (error) {
    console.error(error);
    return data({ ok: false, error: 'Invalid Stripe signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const paymentIntentId = getPaymentIntentId(session);

      if (
        !session.id ||
        typeof session.amount_total !== 'number' ||
        !session.currency ||
        !paymentIntentId
      ) {
        return data({ ok: false, error: 'Invalid Checkout Session' }, { status: 400 });
      }

      const bookingAccessToken = generateCheckoutAccessToken();
      const result = await completeCheckoutAttempt({
        stripeCheckoutSessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        stripePaymentIntentId: paymentIntentId,
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
        try {
          const refund = await createRefundForPaymentIntent(paymentIntentId);
          await updateCheckoutAttemptRefundStatus({
            id: result.checkoutAttempt._id,
            paymentStatus: 'refunded',
            stripeRefundId: refund.id,
          });
        } catch (refundError) {
          await updateCheckoutAttemptRefundStatus({
            id: result.checkoutAttempt._id,
            paymentStatus: 'refund_failed',
          });
          throw refundError;
        }

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
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;

      if (!session.id) {
        return data({ ok: false, error: 'Invalid Checkout Session' }, { status: 400 });
      }

      await expireCheckoutAttempt(session.id);
    }
  } catch (error) {
    console.error(error);
    return data({ ok: false, error: 'Unable to process Stripe event' }, { status: 400 });
  }

  return { ok: true };
}
