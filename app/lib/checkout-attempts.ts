import { createHash, randomBytes } from 'node:crypto';

import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { CheckoutAttemptId, NormalizedCheckoutAttempt } from './types';
import { tryCatch } from './utils';

export const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

function getConvex() {
  return new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
}

type CheckoutAttemptInput = Omit<
  NormalizedCheckoutAttempt,
  | 'stripeCheckoutSessionId'
  | 'paymentStatus'
  | 'expiresAt'
  | 'accessTokenHash'
>;

export function generateCheckoutAccessToken() {
  return randomBytes(32).toString('base64url');
}

export function hashCheckoutAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyCheckoutAccessToken(token: string, hash: string) {
  return hashCheckoutAccessToken(token) === hash;
}

export async function getCheckoutAttempt(
  checkoutAttemptId: CheckoutAttemptId,
) {
  const [checkoutAttempt, err] = await tryCatch(
    getConvex().query(api.checkoutAttempts.getCheckoutAttemptById, {
      checkoutAttemptId,
    }),
  );

  if (err) throw new Error('Something went wrong');

  return checkoutAttempt;
}

export async function getCheckoutAttemptWithTour(
  checkoutAttemptId: CheckoutAttemptId,
) {
  const [res, err] = await tryCatch(
    getConvex().query(api.checkoutAttempts.getCheckoutAttemptWithTour, {
      checkoutAttemptId,
    }),
  );

  if (err) throw new Error('Something went wrong');

  return res;
}

export async function saveCheckoutAttempt(input: CheckoutAttemptInput) {
  const accessToken = generateCheckoutAccessToken();
  const expiresAt = Date.now() + CHECKOUT_ATTEMPT_TTL_MS;
  const checkoutAttemptId = await getConvex().mutation(
    api.checkoutAttempts.createCheckoutAttempt,
    {
      ...input,
      stripeCheckoutSessionId: null,
      paymentStatus: 'pending',
      expiresAt,
      accessTokenHash: hashCheckoutAccessToken(accessToken),
    },
  );

  return { checkoutAttemptId, accessToken, expiresAt };
}

export async function updateCheckoutAttempt(
  updates: Partial<
    Pick<
      NormalizedCheckoutAttempt,
      'stripeCheckoutSessionId' | 'paymentStatus' | 'expiresAt'
    >
  > & { id: Id<'checkoutAttempts'> },
) {
  const checkoutAttemptId = await getConvex().mutation(
    api.checkoutAttempts.updateCheckoutAttempt,
    updates,
  );
  return checkoutAttemptId;
}
