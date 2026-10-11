import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeCapture } from '~/lib/checkout-completion';
import { convexMutation } from '~/lib/convex.server';
import { convexCalls } from '~/lib/convex.test-helpers';
import { sendBookingCommunication } from '~/lib/email';
import { verifyPayPalWebhook } from '~/lib/paypal';

import { action } from './paypal-webhook';

vi.mock('~/lib/paypal', () => ({ verifyPayPalWebhook: vi.fn() }));
vi.mock('~/lib/checkout-completion', () => ({
  completeCapture: vi.fn(),
}));
vi.mock('~/lib/convex.server', () => ({ convexMutation: vi.fn() }));
vi.mock('~/lib/email', () => ({
  sendBookingCommunication: vi.fn(),
}));

const verifyPayPalWebhookMock = vi.mocked(verifyPayPalWebhook);
const completeCaptureMock = vi.mocked(completeCapture);
const mutation = vi.mocked(convexMutation);
const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);

const completedCapture = {
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'CAPTURE-123',
    amount: { value: '158.00', currency_code: 'USD' },
    supplementary_data: { related_ids: { order_id: 'ORDER-123' } },
  },
};

const checkoutAttempt = {
  bookerEmail: 'booker@example.com',
  bookerName: 'Test Booker',
  date: '2026-07-04',
  time: '10:00 AM',
  guests: 2,
  total: 158,
};

const tour = { name: 'Savannah Food Tour', price: 79 };

function webhookRequest(body = '{"id":"WH-123"}') {
  return new Request('https://example.com/paypal/webhook', {
    method: 'POST',
    body,
  });
}

function actionArgs(request = webhookRequest()) {
  return { request, params: {}, context: {} } as never;
}

function expectNoProcessing() {
  expect(completeCaptureMock).not.toHaveBeenCalled();
  expect(mutation).not.toHaveBeenCalled();
  expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
}

describe('PayPal webhook action', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('rejects failed verification before processing', async () => {
    verifyPayPalWebhookMock.mockRejectedValueOnce(new Error('bad signature'));
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs());

    expect(response).toMatchObject({
      data: { ok: false, error: 'Invalid PayPal webhook' },
      init: { status: 400 },
    });
    expect(consoleErrorMock).toHaveBeenCalledOnce();
    expectNoProcessing();
  });

  it('hands completed capture fields to Checkout completion', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce(completedCapture);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(completeCaptureMock).toHaveBeenCalledWith({
      status: 'COMPLETED',
      paypalOrderId: 'ORDER-123',
      paypalCaptureId: 'CAPTURE-123',
      amountValue: '158.00',
      currency: 'USD',
    });
  });

  it('rejects completed captures without an amount', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      ...completedCapture,
      resource: { ...completedCapture.resource, amount: undefined },
    });

    const response = await action(actionArgs());

    expect(response).toMatchObject({
      data: { ok: false, error: 'Invalid Checkout Session' },
      init: { status: 400 },
    });
    expect(completeCaptureMock).not.toHaveBeenCalled();
  });

  it('returns a retryable error when downstream processing throws', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce(completedCapture);
    completeCaptureMock.mockRejectedValueOnce(new Error('amount mismatch'));
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs());

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to process PayPal event' },
      init: { status: 400 },
    });
    expect(JSON.parse(consoleErrorMock.mock.calls[0][0])).toMatchObject({
      event: 'paypal.webhook_failed',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      error: { message: 'amount mismatch' },
    });
  });

  it('accepts duplicate completed capture deliveries', async () => {
    verifyPayPalWebhookMock.mockResolvedValue(completedCapture);
    completeCaptureMock.mockResolvedValue('paid');

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });
    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(completeCaptureMock).toHaveBeenCalledTimes(2);
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });

  it.each(['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'])(
    'hands %s captures to Checkout completion as declined',
    async (eventType) => {
      verifyPayPalWebhookMock.mockResolvedValueOnce({
        event_type: eventType,
        resource: {
          supplementary_data: { related_ids: { order_id: 'ORDER-123' } },
        },
      });

      await expect(action(actionArgs())).resolves.toEqual({ ok: true });

      expect(completeCaptureMock).toHaveBeenCalledWith({
        status: 'DECLINED',
        paypalOrderId: 'ORDER-123',
      });
    },
  );

  it('expires reversed approvals without communication', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
      resource: { order_id: 'ORDER-123' },
    });

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(convexCalls(mutation)).toEqual([
      ['checkoutAttempts:expireCheckoutAttempt', { paypalOrderId: 'ORDER-123' }],
    ]);
    expect(completeCaptureMock).not.toHaveBeenCalled();
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });

  it('marks completed refunds refunded without communication', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: { id: 'REFUND-123' },
    });
    mutation.mockResolvedValueOnce({
      status: 'updated_booking',
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(convexCalls(mutation)).toEqual([
      ['checkoutAttempts:updateRefundStatusByPayPalRefund', { paypalRefundId: 'REFUND-123', paymentStatus: 'refunded' }],
    ]);
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });

  it('sends Booking Communication when a Booking refund fails', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    const booking = { ...checkoutAttempt, _id: 'booking_123' };
    mutation.mockResolvedValueOnce({
      status: 'updated_booking',
      booking,
      tour,
      total: 150,
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(convexCalls(mutation)).toEqual([
      ['checkoutAttempts:updateRefundStatusByPayPalRefund', { paypalRefundId: 'REFUND-123', paymentStatus: 'refund_failed' }],
    ]);
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith('refund_failed', {
      booking,
      tour,
      total: 150,
    });
  });

  it('sends Booking Communication when a Checkout Attempt refund fails', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    const attempt = { ...checkoutAttempt, _id: 'checkout_attempt_123', total: 150 };
    mutation.mockResolvedValueOnce({
      status: 'updated_checkout_attempt',
      checkoutAttempt: attempt,
      tour,
    } as never);

    await action(actionArgs());

    expect(sendBookingCommunicationMock).toHaveBeenCalledWith('refund_failed', {
      checkoutAttempt: attempt,
      tour,
    });
  });

  it('does not repeat communication for an already updated refund', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    mutation.mockResolvedValueOnce({
      status: 'already_updated',
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
  });

  it.each(['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.REFUND.FAILED'])(
    'retries %s when the refund reference is not persisted yet',
    async (eventType) => {
      verifyPayPalWebhookMock.mockResolvedValueOnce({
        event_type: eventType,
        resource: { id: 'REFUND-UNKNOWN' },
      });
      mutation.mockResolvedValueOnce({
        status: 'not_found',
      } as never);

      const response = await action(actionArgs());

      expect(response).toMatchObject({
        data: {
          ok: false,
          error: 'PayPal refund is not ready for reconciliation',
        },
        init: { status: 503 },
      });
      expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    },
  );

  it('accepts unknown event types without processing', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'CUSTOMER.DISPUTE.CREATED',
      resource: {},
    });

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expectNoProcessing();
  });
});
