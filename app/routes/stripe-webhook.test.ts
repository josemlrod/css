import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  completeCheckoutAttempt,
  expireCheckoutAttempt,
} from '~/lib/checkout-attempts';
import { constructStripeWebhookEvent } from '~/lib/stripe';

import { action } from './stripe-webhook';

vi.mock('~/lib/checkout-attempts', () => ({
  completeCheckoutAttempt: vi.fn(),
  expireCheckoutAttempt: vi.fn(),
}));

vi.mock('~/lib/stripe', () => ({
  constructStripeWebhookEvent: vi.fn(),
}));

const completeCheckoutAttemptMock = vi.mocked(completeCheckoutAttempt);
const expireCheckoutAttemptMock = vi.mocked(expireCheckoutAttempt);
const constructStripeWebhookEventMock = vi.mocked(constructStripeWebhookEvent);

function webhookRequest(body = '{}') {
  return new Request('https://example.com/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'sig_test' },
  });
}

function actionArgs(request: Request) {
  return {
    request,
    params: {},
    context: {},
  } as never;
}

describe('Stripe webhook action', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid signatures before processing events', async () => {
    constructStripeWebhookEventMock.mockImplementationOnce(() => {
      throw new Error('bad sig');
    });
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs(webhookRequest()));

    expect(response).toMatchObject({ init: { status: 400 } });
    expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
    expect(consoleErrorMock).toHaveBeenCalledOnce();
  });

  it('creates Booking only from verified Checkout completion webhooks', async () => {
    constructStripeWebhookEventMock.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 15800,
          currency: 'usd',
          payment_intent: 'pi_test_123',
        },
      },
    } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    expect(completeCheckoutAttemptMock).toHaveBeenCalledWith({
      stripeCheckoutSessionId: 'cs_test_123',
      amountTotal: 15800,
      currency: 'usd',
      stripePaymentIntentId: 'pi_test_123',
    });
  });

  it('marks expired Checkout Sessions without creating Booking', async () => {
    constructStripeWebhookEventMock.mockReturnValueOnce({
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_123' } },
    } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    expect(expireCheckoutAttemptMock).toHaveBeenCalledWith('cs_test_123');
    expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects amountless Checkout completion events', async () => {
    constructStripeWebhookEventMock.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          currency: 'usd',
          payment_intent: 'pi_test_123',
        },
      },
    } as never);

    const response = await action(actionArgs(webhookRequest()));

    expect(response).toMatchObject({ init: { status: 400 } });
    expect(completeCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('returns an error when Checkout completion verification fails downstream', async () => {
    constructStripeWebhookEventMock.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 15801,
          currency: 'usd',
          payment_intent: 'pi_test_123',
        },
      },
    } as never);
    completeCheckoutAttemptMock.mockRejectedValueOnce(
      new Error('Checkout amount mismatch'),
    );
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs(webhookRequest()));

    expect(response).toMatchObject({ init: { status: 400 } });
    expect(consoleErrorMock).toHaveBeenCalledWith(
      new Error('Checkout amount mismatch'),
    );
  });

  it('accepts duplicate Checkout completion delivery through idempotent mutation', async () => {
    constructStripeWebhookEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 15800,
          currency: 'usd',
          payment_intent: 'pi_test_123',
        },
      },
    } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    expect(completeCheckoutAttemptMock).toHaveBeenCalledTimes(2);
  });
});
