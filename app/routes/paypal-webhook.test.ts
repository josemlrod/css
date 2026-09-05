import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  expireCheckoutAttempt,
  failCheckoutAttempt,
  updateRefundStatusByPayPalRefund,
} from '~/lib/checkout-attempts';
import { finalizePaidCapture } from '~/lib/checkout-completion';
import { sendRefundFailedCommunication } from '~/lib/email';
import { verifyPayPalWebhook } from '~/lib/paypal';

import { action } from './paypal-webhook';

vi.mock('~/lib/paypal', () => ({ verifyPayPalWebhook: vi.fn() }));
vi.mock('~/lib/checkout-completion', () => ({
  finalizePaidCapture: vi.fn(),
}));
vi.mock('~/lib/checkout-attempts', () => ({
  expireCheckoutAttempt: vi.fn(),
  failCheckoutAttempt: vi.fn(),
  updateRefundStatusByPayPalRefund: vi.fn(),
}));
vi.mock('~/lib/email', () => ({
  sendRefundFailedCommunication: vi.fn(),
}));

const verifyPayPalWebhookMock = vi.mocked(verifyPayPalWebhook);
const finalizePaidCaptureMock = vi.mocked(finalizePaidCapture);
const expireCheckoutAttemptMock = vi.mocked(expireCheckoutAttempt);
const failCheckoutAttemptMock = vi.mocked(failCheckoutAttempt);
const updateRefundStatusByPayPalRefundMock = vi.mocked(
  updateRefundStatusByPayPalRefund,
);
const sendRefundFailedCommunicationMock = vi.mocked(
  sendRefundFailedCommunication,
);

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
  expect(finalizePaidCaptureMock).not.toHaveBeenCalled();
  expect(expireCheckoutAttemptMock).not.toHaveBeenCalled();
  expect(failCheckoutAttemptMock).not.toHaveBeenCalled();
  expect(updateRefundStatusByPayPalRefundMock).not.toHaveBeenCalled();
  expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
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

  it('maps completed capture fields to the shared finalizer', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce(completedCapture);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(finalizePaidCaptureMock).toHaveBeenCalledWith({
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
    expect(finalizePaidCaptureMock).not.toHaveBeenCalled();
  });

  it('returns a retryable error when downstream processing throws', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce(completedCapture);
    finalizePaidCaptureMock.mockRejectedValueOnce(new Error('amount mismatch'));
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs());

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to process PayPal event' },
      init: { status: 400 },
    });
    expect(consoleErrorMock).toHaveBeenCalledWith(new Error('amount mismatch'));
  });

  it('accepts duplicate completed capture deliveries', async () => {
    verifyPayPalWebhookMock.mockResolvedValue(completedCapture);
    finalizePaidCaptureMock.mockResolvedValue({
      status: 'booking_exists',
      bookingId: 'booking_123',
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });
    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(finalizePaidCaptureMock).toHaveBeenCalledTimes(2);
    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it.each(['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'])(
    'marks %s captures failed without communication',
    async (eventType) => {
      verifyPayPalWebhookMock.mockResolvedValueOnce({
        event_type: eventType,
        resource: {
          supplementary_data: { related_ids: { order_id: 'ORDER-123' } },
        },
      });

      await expect(action(actionArgs())).resolves.toEqual({ ok: true });

      expect(failCheckoutAttemptMock).toHaveBeenCalledWith({
        paypalOrderId: 'ORDER-123',
      });
      expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
    },
  );

  it('expires reversed approvals without communication', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
      resource: { order_id: 'ORDER-123' },
    });

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(expireCheckoutAttemptMock).toHaveBeenCalledWith({
      paypalOrderId: 'ORDER-123',
    });
    expect(finalizePaidCaptureMock).not.toHaveBeenCalled();
    expect(failCheckoutAttemptMock).not.toHaveBeenCalled();
    expect(updateRefundStatusByPayPalRefundMock).not.toHaveBeenCalled();
    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it('marks completed refunds refunded without communication', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: { id: 'REFUND-123' },
    });
    updateRefundStatusByPayPalRefundMock.mockResolvedValueOnce({
      status: 'updated_booking',
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(updateRefundStatusByPayPalRefundMock).toHaveBeenCalledWith({
      paypalRefundId: 'REFUND-123',
      paymentStatus: 'refunded',
    });
    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it('sends Booking Communication when a Booking refund fails', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    updateRefundStatusByPayPalRefundMock.mockResolvedValueOnce({
      status: 'updated_booking',
      booking: checkoutAttempt,
      tour,
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(updateRefundStatusByPayPalRefundMock).toHaveBeenCalledWith({
      paypalRefundId: 'REFUND-123',
      paymentStatus: 'refund_failed',
    });
    expect(sendRefundFailedCommunicationMock).toHaveBeenCalledWith({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });
  });

  it('uses Checkout Attempt totals when its refund fails', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    updateRefundStatusByPayPalRefundMock.mockResolvedValueOnce({
      status: 'updated_checkout_attempt',
      checkoutAttempt: { ...checkoutAttempt, total: 150 },
      tour,
    } as never);

    await action(actionArgs());

    expect(sendRefundFailedCommunicationMock).toHaveBeenCalledWith(
      expect.objectContaining({ total: 150 }),
    );
  });

  it('does not repeat communication for an already updated refund', async () => {
    verifyPayPalWebhookMock.mockResolvedValueOnce({
      event_type: 'PAYMENT.REFUND.FAILED',
      resource: { id: 'REFUND-123' },
    });
    updateRefundStatusByPayPalRefundMock.mockResolvedValueOnce({
      status: 'already_updated',
    } as never);

    await expect(action(actionArgs())).resolves.toEqual({ ok: true });

    expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
  });

  it.each(['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.REFUND.FAILED'])(
    'retries %s when the refund reference is not persisted yet',
    async (eventType) => {
      verifyPayPalWebhookMock.mockResolvedValueOnce({
        event_type: eventType,
        resource: { id: 'REFUND-UNKNOWN' },
      });
      updateRefundStatusByPayPalRefundMock.mockResolvedValueOnce({
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
      expect(sendRefundFailedCommunicationMock).not.toHaveBeenCalled();
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
