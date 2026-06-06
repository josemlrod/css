import { data } from 'react-router';
import type Stripe from 'stripe';

import {
  completeCheckoutAttempt,
  expireCheckoutAttempt,
} from '~/lib/checkout-attempts';
import { constructStripeWebhookEvent } from '~/lib/stripe';

import type { Route } from './+types/stripe-webhook';

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
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

      await completeCheckoutAttempt({
        stripeCheckoutSessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        stripePaymentIntentId: paymentIntentId,
      });
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
