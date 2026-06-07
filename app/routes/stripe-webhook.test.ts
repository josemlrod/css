import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  completeCheckoutAttempt,
  expireCheckoutAttempt,
  generateCheckoutAccessToken,
  hashCheckoutAccessToken,
  updateCheckoutAttemptRefundStatus,
} from '~/lib/checkout-attempts';
import { constructStripeWebhookEvent, createRefundForPaymentIntent } from '~/lib/stripe';
import {
  sendBookingCommunication,
  sendFailedCapacityRefundCommunication,
} from '~/lib/email';

import { action } from './stripe-webhook';

vi.mock('~/lib/checkout-attempts', () => ({
  completeCheckoutAttempt: vi.fn(),
  expireCheckoutAttempt: vi.fn(),
  generateCheckoutAccessToken: vi.fn(() => 'raw_booking_token'),
  hashCheckoutAccessToken: vi.fn(() => 'hashed_booking_token'),
  updateCheckoutAttemptRefundStatus: vi.fn(),
}));

vi.mock('~/lib/stripe', () => ({
  constructStripeWebhookEvent: vi.fn(),
  createRefundForPaymentIntent: vi.fn(),
}));

vi.mock('~/lib/email', () => ({
  sendBookingCommunication: vi.fn(),
  sendFailedCapacityRefundCommunication: vi.fn(),
}));

const completeCheckoutAttemptMock = vi.mocked(completeCheckoutAttempt);
const expireCheckoutAttemptMock = vi.mocked(expireCheckoutAttempt);
const generateCheckoutAccessTokenMock = vi.mocked(generateCheckoutAccessToken);
const hashCheckoutAccessTokenMock = vi.mocked(hashCheckoutAccessToken);
const updateCheckoutAttemptRefundStatusMock = vi.mocked(
  updateCheckoutAttemptRefundStatus,
);
const constructStripeWebhookEventMock = vi.mocked(constructStripeWebhookEvent);
const createRefundForPaymentIntentMock = vi.mocked(createRefundForPaymentIntent);
const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);
const sendFailedCapacityRefundCommunicationMock = vi.mocked(
  sendFailedCapacityRefundCommunication,
);

const checkoutAttempt = {
  _id: 'checkout_attempt_123',
  bookerEmail: 'booker@example.com',
  bookerName: 'Test Booker',
  date: '2026-07-04',
  time: '10:00 AM',
  guests: 2,
  total: 158,
};

const tour = {
  name: 'Savannah Food Tour',
  meetingPoint: 'City Market',
};

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
    delete process.env.APP_ORIGIN;
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
    process.env.APP_ORIGIN = 'https://example.com';
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
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'booking_created',
      bookingId: 'booking_123',
      checkoutAttempt,
      tour,
    } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    expect(completeCheckoutAttemptMock).toHaveBeenCalledWith({
      stripeCheckoutSessionId: 'cs_test_123',
      amountTotal: 15800,
      currency: 'usd',
      stripePaymentIntentId: 'pi_test_123',
      bookingAccessTokenHash: 'hashed_booking_token',
    });
    expect(generateCheckoutAccessTokenMock).toHaveBeenCalledOnce();
    expect(hashCheckoutAccessTokenMock).toHaveBeenCalledWith('raw_booking_token');
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
      meetingPoint: 'City Market',
      editUrl: 'https://example.com/manage/booking_123?token=raw_booking_token',
      cancelUrl: 'https://example.com/manage/booking_123?token=raw_booking_token',
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
    completeCheckoutAttemptMock.mockResolvedValue({
      status: 'booking_exists',
      bookingId: 'booking_123',
    } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });
    expect(completeCheckoutAttemptMock).toHaveBeenCalledTimes(2);
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(createRefundForPaymentIntentMock).not.toHaveBeenCalled();
  });

  it('refunds paid Checkout completion when capacity becomes unavailable', async () => {
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
    completeCheckoutAttemptMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      checkoutAttempt,
      tour,
    } as never);
    createRefundForPaymentIntentMock.mockResolvedValueOnce({ id: 're_test_123' } as never);

    await expect(action(actionArgs(webhookRequest()))).resolves.toEqual({ ok: true });

    expect(createRefundForPaymentIntentMock).toHaveBeenCalledWith('pi_test_123');
    expect(updateCheckoutAttemptRefundStatusMock).toHaveBeenCalledWith({
      id: 'checkout_attempt_123',
      paymentStatus: 'refunded',
      stripeRefundId: 're_test_123',
    });
    expect(sendFailedCapacityRefundCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });
});
