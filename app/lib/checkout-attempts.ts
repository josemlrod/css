import { api } from '../../convex/_generated/api';
import { generateAccessToken, hashAccessToken } from './access-tokens';
import { convexMutation } from './convex.server';
import type { NormalizedCheckoutAttempt } from './types';

export const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

type CheckoutAttemptInput = Omit<
  NormalizedCheckoutAttempt,
  | 'paypalOrderId'
  | 'paymentStatus'
  | 'expiresAt'
  | 'accessTokenHash'
  | 'failureReason'
  | 'paypalRefundId'
>;

export async function saveCheckoutAttempt(input: CheckoutAttemptInput) {
  const accessToken = generateAccessToken();
  const expiresAt = Date.now() + CHECKOUT_ATTEMPT_TTL_MS;
  const checkoutAttemptId = await convexMutation(
    api.checkoutAttempts.createCheckoutAttempt,
    {
      ...input,
      paypalOrderId: null,
      paymentStatus: 'pending',
      expiresAt,
      accessTokenHash: hashAccessToken(accessToken),
    },
  );

  return { checkoutAttemptId, accessToken, expiresAt };
}
