import type { CheckoutAttemptId, Tour } from './types';

type CreatePayPalOrderInput = {
  checkoutAttemptId: CheckoutAttemptId;
  accessToken: string;
  tour: Tour;
  date: string;
  time: string;
  guests: number;
  total: number;
  bookerEmail: string;
  origin: string;
};

type PayPalCapture = {
  id: string;
  status: string;
  amount: {
    value: string;
    currency_code: string;
  };
  custom_id: string;
};

type PayPalOrder = {
  purchase_units: Array<{
    payments: { captures: PayPalCapture[] };
  }>;
};

class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(`PayPal API request failed (${status}): ${message}`);
  }
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is required`);

  return value;
}

function getPayPalBaseUrl() {
  const environment = requiredEnvironmentVariable('PAYPAL_ENV');

  if (environment === 'sandbox') return 'https://api-m.sandbox.paypal.com';
  if (environment === 'live') return 'https://api-m.paypal.com';

  throw new Error('PAYPAL_ENV must be sandbox or live');
}

async function parsePayPalResponse<T>(response: Response) {
  if (!response.ok) {
    const message = await response.text();
    let body: unknown = message;

    try {
      body = JSON.parse(message);
    } catch {
      // Keep non-JSON PayPal responses available in the error message.
    }

    throw new PayPalApiError(response.status, body, message);
  }

  return (await response.json()) as T;
}

function orderAlreadyCaptured(error: unknown) {
  if (!(error instanceof PayPalApiError) || error.status !== 422) return false;

  const details = (error.body as { details?: Array<{ issue?: string }> })?.details;
  return details?.some(({ issue }) => issue === 'ORDER_ALREADY_CAPTURED') ?? false;
}

function getCapture(order: PayPalOrder) {
  const capture = order.purchase_units[0]?.payments.captures[0];

  if (!capture) throw new Error('PayPal capture response is missing a capture');

  return capture;
}

async function payPalRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await getPayPalAccessToken()}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  return await parsePayPalResponse<T>(response);
}

export async function getPayPalAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.value;
  }

  const clientId = requiredEnvironmentVariable('PAYPAL_CLIENT_ID');
  const clientSecret = requiredEnvironmentVariable('PAYPAL_CLIENT_SECRET');
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const token = await parsePayPalResponse<{
    access_token: string;
    expires_in: number;
  }>(response);

  cachedAccessToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(0, token.expires_in * 1000 - 60_000),
  };

  return cachedAccessToken.value;
}

export async function createPayPalOrder(input: CreatePayPalOrderInput) {
  const returnUrl = new URL(
    `/checkout/success/${input.checkoutAttemptId}`,
    input.origin,
  );
  returnUrl.searchParams.set('token', input.accessToken);
  const cancelUrl = new URL(
    `/checkout/cancel/${input.checkoutAttemptId}`,
    input.origin,
  );
  cancelUrl.searchParams.set('token', input.accessToken);

  const order = await payPalRequest<{ id: string }>('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': input.checkoutAttemptId },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: input.total.toFixed(2),
          },
          custom_id: input.checkoutAttemptId,
          invoice_id: input.checkoutAttemptId,
          description: `${input.tour.name} · ${input.date} at ${input.time}`,
          soft_descriptor: 'CSS TOURS',
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'CSS Tours',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl.toString(),
            cancel_url: cancelUrl.toString(),
          },
        },
      },
    }),
  });

  return { id: order.id };
}

export async function capturePayPalOrder(orderId: string) {
  let order: PayPalOrder;

  try {
    order = await payPalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          'PayPal-Request-Id': `capture-${orderId}`,
          Prefer: 'return=representation',
        },
        body: '{}',
      },
    );
  } catch (error) {
    if (!orderAlreadyCaptured(error)) throw error;

    order = await payPalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    );
  }

  return getCapture(order);
}

export async function refundPayPalCapture(captureId: string) {
  const refund = await payPalRequest<{ id: string; status: string }>(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `refund-${captureId}` },
      body: '{}',
    },
  );

  return { id: refund.id, status: refund.status };
}

export async function verifyPayPalWebhook({
  headers,
  rawBody,
}: {
  headers: Headers;
  rawBody: string;
}) {
  const event = JSON.parse(rawBody) as unknown;
  const header = (name: string) => {
    const value = headers.get(name);

    if (!value) throw new Error(`Missing PayPal webhook header: ${name}`);

    return value;
  };
  const verification = await payPalRequest<{ verification_status: string }>(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: header('paypal-auth-algo'),
        cert_url: header('paypal-cert-url'),
        transmission_id: header('paypal-transmission-id'),
        transmission_sig: header('paypal-transmission-sig'),
        transmission_time: header('paypal-transmission-time'),
        webhook_id: requiredEnvironmentVariable('PAYPAL_WEBHOOK_ID'),
        webhook_event: event,
      }),
    },
  );

  if (verification.verification_status !== 'SUCCESS') {
    throw new Error('PayPal webhook verification failed');
  }

  return event;
}
