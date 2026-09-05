import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCheckoutAttempt,
  updateCheckoutAttempt,
  verifyCheckoutAccessToken,
} from '~/lib/checkout-attempts';
import { finalizePaidCapture } from '~/lib/checkout-completion';
import { capturePayPalOrder } from '~/lib/paypal';

import { action } from './paypal-capture';

vi.mock('~/lib/checkout-attempts', () => ({
  getCheckoutAttempt: vi.fn(),
  updateCheckoutAttempt: vi.fn(),
  verifyCheckoutAccessToken: vi.fn(),
}));

vi.mock('~/lib/checkout-completion', () => ({ finalizePaidCapture: vi.fn() }));
vi.mock('~/lib/paypal', () => ({ capturePayPalOrder: vi.fn() }));

const getCheckoutAttemptMock = vi.mocked(getCheckoutAttempt);
const updateCheckoutAttemptMock = vi.mocked(updateCheckoutAttempt);
const verifyCheckoutAccessTokenMock = vi.mocked(verifyCheckoutAccessToken);
const finalizePaidCaptureMock = vi.mocked(finalizePaidCapture);
const capturePayPalOrderMock = vi.mocked(capturePayPalOrder);

const checkoutAttempt = {
  _id: 'checkout-attempt-123',
  accessTokenHash: 'hashed-token',
  paypalOrderId: 'ORDER123',
  paymentStatus: 'pending',
  expiresAt: 9_999_999_999_999,
};

function captureRequest(orderId: unknown = 'ORDER123', token = 'raw-token') {
  return new Request(
    `https://example.com/paypal/capture/checkout-attempt-123?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    },
  );
}

function actionArgs(request: Request) {
  return {
    request,
    params: { checkoutAttemptId: 'checkout-attempt-123' },
    context: {},
  } as never;
}

describe('PayPal capture action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCheckoutAttemptMock.mockResolvedValue(checkoutAttempt as never);
    verifyCheckoutAccessTokenMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-POST requests before loading the Checkout Attempt', async () => {
    const response = await action(
      actionArgs(
        new Request(
          'https://example.com/paypal/capture/checkout-attempt-123?token=raw-token',
        ),
      ),
    );

    expect(response).toMatchObject({ init: { status: 405 } });
    expect(getCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an invalid token without calling PayPal', async () => {
    verifyCheckoutAccessTokenMock.mockReturnValueOnce(false);

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({ init: { status: 404 } });
    expect(capturePayPalOrderMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the order does not match the Checkout Attempt', async () => {
    const response = await action(actionArgs(captureRequest('OTHER_ORDER')));

    expect(response).toMatchObject({ init: { status: 400 } });
    expect(capturePayPalOrderMock).not.toHaveBeenCalled();
  });

  it('rejects an expired pending attempt without calling PayPal', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    getCheckoutAttemptMock.mockResolvedValueOnce({
      ...checkoutAttempt,
      expiresAt: 1_000,
    } as never);

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({
      data: { ok: false, status: 'expired', error: 'Checkout expired' },
      init: { status: 409 },
    });
    expect(capturePayPalOrderMock).not.toHaveBeenCalled();
  });

  it('finalizes a completed capture with PayPal payment details', async () => {
    capturePayPalOrderMock.mockResolvedValueOnce({
      id: 'CAPTURE123',
      status: 'COMPLETED',
      amount: { value: '158.00', currency_code: 'USD' },
      custom_id: 'checkout-attempt-123',
    });
    finalizePaidCaptureMock.mockResolvedValueOnce({
      status: 'booking_created',
    } as never);

    const response = await action(actionArgs(captureRequest()));

    expect(finalizePaidCaptureMock).toHaveBeenCalledWith({
      paypalOrderId: 'ORDER123',
      paypalCaptureId: 'CAPTURE123',
      amountValue: '158.00',
      currency: 'USD',
    });
    expect(response).toMatchObject({
      data: {
        ok: true,
        status: 'paid',
        checkoutAttemptId: 'checkout-attempt-123',
      },
    });
  });

  it('returns an immediately completed capacity refund status', async () => {
    capturePayPalOrderMock.mockResolvedValueOnce({
      id: 'CAPTURE123',
      status: 'COMPLETED',
      amount: { value: '158.00', currency_code: 'USD' },
      custom_id: 'checkout-attempt-123',
    });
    finalizePaidCaptureMock.mockResolvedValueOnce({
      status: 'capacity_unavailable',
      paymentStatus: 'refunded',
    } as never);

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({
      data: {
        ok: true,
        status: 'refunded',
        checkoutAttemptId: 'checkout-attempt-123',
      },
    });
  });

  it('leaves a pending capture pending', async () => {
    capturePayPalOrderMock.mockResolvedValueOnce({
      id: 'CAPTURE123',
      status: 'PENDING',
      amount: { value: '158.00', currency_code: 'USD' },
      custom_id: 'checkout-attempt-123',
    });

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({ data: { ok: true, status: 'pending' } });
    expect(finalizePaidCaptureMock).not.toHaveBeenCalled();
    expect(updateCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('marks a declined capture failed without sending Booking Communication', async () => {
    capturePayPalOrderMock.mockResolvedValueOnce({
      id: 'CAPTURE123',
      status: 'DECLINED',
      amount: { value: '158.00', currency_code: 'USD' },
      custom_id: 'checkout-attempt-123',
    });

    const response = await action(actionArgs(captureRequest()));

    expect(updateCheckoutAttemptMock).toHaveBeenCalledWith({
      id: 'checkout-attempt-123',
      paymentStatus: 'failed',
    });
    expect(finalizePaidCaptureMock).not.toHaveBeenCalled();
    expect(response).toMatchObject({ data: { ok: false, status: 'failed' } });
  });

  it('returns an already-paid attempt without calling PayPal', async () => {
    getCheckoutAttemptMock.mockResolvedValueOnce({
      ...checkoutAttempt,
      paymentStatus: 'paid',
    } as never);

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({ data: { ok: true, status: 'paid' } });
    expect(capturePayPalOrderMock).not.toHaveBeenCalled();
  });

  it('returns 500 when PayPal capture fails unexpectedly', async () => {
    const captureError = new Error('PayPal unavailable');
    capturePayPalOrderMock.mockRejectedValueOnce(captureError);
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const response = await action(actionArgs(captureRequest()));

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to complete payment' },
      init: { status: 500 },
    });
    expect(consoleErrorMock).toHaveBeenCalledWith(captureError);
  });
});
