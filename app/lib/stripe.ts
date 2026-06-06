import Stripe from 'stripe';

import type { CheckoutAttemptId, Tour } from './types';

type CreateCheckoutSessionInput = {
  checkoutAttemptId: CheckoutAttemptId;
  accessToken: string;
  expiresAt: number;
  origin: string;
  tour: Tour;
  date: string;
  time: string;
  guests: number;
  bookerEmail: string;
};

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }

  return new Stripe(secretKey);
}

export async function createCheckoutSession({
  checkoutAttemptId,
  accessToken,
  expiresAt,
  origin,
  tour,
  date,
  time,
  guests,
  bookerEmail,
}: CreateCheckoutSessionInput) {
  return await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: bookerEmail,
    line_items: [
      {
        quantity: guests,
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100,
          product_data: {
            name: tour.name,
            description: `${date} at ${time}`,
          },
        },
      },
    ],
    expires_at: Math.floor(expiresAt / 1000),
    success_url: new URL(
      `/checkout/success/${checkoutAttemptId}?token=${accessToken}`,
      origin,
    ).toString(),
    cancel_url: new URL(
      `/checkout/cancel/${checkoutAttemptId}?token=${accessToken}`,
      origin,
    ).toString(),
    metadata: {
      checkoutAttemptId,
    },
  });
}
