import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPayPalOrder, verifyPayPalWebhook } from './paypal';

function paypalHeaders() {
  return new Headers({
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/cert.pem',
    'paypal-transmission-id': 'transmission-123',
    'paypal-transmission-sig': 'signature-123',
    'paypal-transmission-time': '2026-09-04T12:00:00Z',
  });
}

describe('PayPal API client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates an idempotent order with the Checkout Attempt details', async () => {
    vi.stubEnv('PAYPAL_ENV', 'sandbox');
    vi.stubEnv('PAYPAL_CLIENT_ID', 'client-id');
    vi.stubEnv('PAYPAL_CLIENT_SECRET', 'client-secret');
    const fetchMock = vi.fn(
      async (input: string | URL | Request, _init?: RequestInit) => {
        const url = input.toString();

        if (url.endsWith('/v1/oauth2/token')) {
          return Response.json({ access_token: 'paypal-token', expires_in: 3600 });
        }

        return Response.json({ id: 'ORDER123' });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createPayPalOrder({
        checkoutAttemptId: 'checkout-attempt-123' as never,
        accessToken: 'private-return-token',
        tour: { name: 'Southern Flavors Food Tour' } as never,
        date: '2026-09-12',
        time: '11:30 AM',
        guests: 2,
        total: 158,
        bookerEmail: 'ada@example.com',
        origin: 'https://example.com',
      }),
    ).resolves.toEqual({ id: 'ORDER123' });

    const orderCall = fetchMock.mock.calls.find(([input]) =>
      input.toString().endsWith('/v2/checkout/orders'),
    );
    expect(orderCall).toBeDefined();
    const init = orderCall?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);

    expect(body.purchase_units[0]).toMatchObject({
      amount: { currency_code: 'USD', value: '158.00' },
      custom_id: 'checkout-attempt-123',
      invoice_id: 'checkout-attempt-123',
    });
    expect(new Headers(init.headers).get('PayPal-Request-Id')).toBe(
      'checkout-attempt-123',
    );
  });

  it('rejects a webhook when PayPal does not verify its signature', async () => {
    vi.stubEnv('PAYPAL_ENV', 'sandbox');
    vi.stubEnv('PAYPAL_CLIENT_ID', 'client-id');
    vi.stubEnv('PAYPAL_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('PAYPAL_WEBHOOK_ID', 'webhook-id');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (input.toString().endsWith('/v1/oauth2/token')) {
          return Response.json({ access_token: 'paypal-token', expires_in: 3600 });
        }

        return Response.json({ verification_status: 'FAILURE' });
      }),
    );

    await expect(
      verifyPayPalWebhook({
        headers: paypalHeaders(),
        rawBody: JSON.stringify({ id: 'WH-123', event_type: 'TEST' }),
      }),
    ).rejects.toThrow('PayPal webhook verification failed');
  });
});
