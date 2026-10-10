import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterContextProvider } from 'react-router';

import { convexAuthAction, convexQuery } from '~/lib/convex.server';
import {
  operatorContext,
  requireOperator,
  serializeOperatorSession,
} from '~/lib/operator-session.server';

import { isOperatorEmail } from '../../../convex/lib/operators';
import { action as loginAction } from './login';

vi.mock('~/lib/convex.server', () => ({
  convexAuthAction: vi.fn(),
  convexQuery: vi.fn(),
}));

const authAction = vi.mocked(convexAuthAction);
const query = vi.mocked(convexQuery);
const operator = { name: 'Ana Ops', email: 'ops@example.com' };

function jwt(expiresInSeconds: number) {
  const payload = { exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}

async function adminRequest(tokens?: { token: string; refreshToken: string }) {
  const cookie = tokens ? (await serializeOperatorSession(tokens)).split(';')[0] : '';
  return new Request('https://example.com/admin/bookings', { headers: { Cookie: cookie } });
}

async function runMiddleware(request: Request) {
  const context = new RouterContextProvider();
  const response = await (requireOperator as Function)(
    { request, context, params: {} },
    async () => new Response('ok'),
  ).catch((thrown: Response) => thrown);
  return { response: response as Response, context };
}

function login(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return loginAction({
    request: new Request('https://example.com/admin/login', { method: 'POST', body }),
  } as never);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('isOperatorEmail', () => {
  it('matches the allowlist ignoring case and spaces', () => {
    vi.stubEnv('OPERATOR_ALLOWED_EMAILS', ' Ops@Example.com ,, owner@example.com');

    expect(isOperatorEmail('ops@example.COM')).toBe(true);
    expect(isOperatorEmail('stranger@example.com')).toBe(false);
    expect(isOperatorEmail(undefined)).toBe(false);
  });
});

describe('requireOperator', () => {
  it('redirects to sign-in without a session cookie', async () => {
    const { response } = await runMiddleware(await adminRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/login');
    expect(query).not.toHaveBeenCalled();
  });

  it('lets a live session through without rewriting the cookie', async () => {
    query.mockResolvedValueOnce(operator);
    const tokens = { token: jwt(3600), refreshToken: 'refresh' };
    const { response, context } = await runMiddleware(await adminRequest(tokens));

    expect(query).toHaveBeenCalledWith(expect.anything(), {}, tokens.token);
    expect(context.get(operatorContext)).toEqual(operator);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('refreshes an expiring JWT and stores the new tokens', async () => {
    const fresh = { token: jwt(3600), refreshToken: 'refresh-2' };
    authAction.mockResolvedValueOnce({ tokens: fresh });
    query.mockResolvedValueOnce(operator);
    const { response } = await runMiddleware(
      await adminRequest({ token: jwt(10), refreshToken: 'refresh-1' }),
    );

    expect(authAction).toHaveBeenCalledWith(expect.anything(), { refreshToken: 'refresh-1' });
    expect(response.headers.get('Set-Cookie')).toContain(
      (await serializeOperatorSession(fresh)).split(';')[0],
    );
  });

  it('signs out when the refresh fails or the Operator is no longer allowed', async () => {
    authAction.mockRejectedValueOnce(new Error('expired'));
    const refreshFailed = await runMiddleware(
      await adminRequest({ token: jwt(-10), refreshToken: 'old' }),
    );
    query.mockResolvedValueOnce(null);
    const revoked = await runMiddleware(
      await adminRequest({ token: jwt(3600), refreshToken: 'refresh' }),
    );

    for (const { response } of [refreshFailed, revoked]) {
      expect(response.headers.get('Location')).toBe('/admin/login');
      expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    }
  });
});

describe('login action', () => {
  it('starts a session when Convex Auth returns tokens', async () => {
    authAction.mockResolvedValueOnce({ tokens: { token: jwt(3600), refreshToken: 'r' } });
    const response = (await login({
      intent: 'sign-in',
      email: ' OPS@example.com ',
      password: 'supersecret',
    })) as Response;

    expect(authAction).toHaveBeenCalledWith(expect.anything(), {
      provider: 'password',
      params: { flow: 'signIn', email: 'ops@example.com', password: 'supersecret' },
    });
    expect(response.headers.get('Location')).toBe('/admin');
    expect(response.headers.get('Set-Cookie')).toContain('operator_session=');
  });

  it('asks for the emailed code when the account still needs verifying', async () => {
    authAction.mockResolvedValueOnce({ tokens: null });

    expect(
      await login({ intent: 'sign-up', name: 'Ana', email: 'ops@example.com', password: 'supersecret' }),
    ).toEqual({ step: 'code', email: 'ops@example.com' });
  });

  it('rejects bad input and failed sign-ins without saying why', async () => {
    authAction.mockRejectedValue(new Error('InvalidSecret'));

    expect(await login({ intent: 'sign-in', email: 'nope' })).toMatchObject({ error: 'Enter a valid email.' });
    expect(
      await login({ intent: 'sign-up', name: 'Ana', email: 'ops@example.com', password: 'short' }),
    ).toMatchObject({ mode: 'sign-up', error: expect.stringContaining('8 characters') });
    expect(
      await login({ intent: 'sign-in', email: 'ops@example.com', password: 'wrong-pass' }),
    ).toMatchObject({ mode: 'sign-in', error: expect.stringContaining("don't match") });
    expect(await login({ intent: 'link-sign-in', code: 'used' })).toMatchObject({ mode: 'link' });
    authAction.mockReset();
  });

  it('gives the same magic link answer whether or not the email is allowed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authAction.mockRejectedValueOnce(new Error('Not an operator email'));

    expect(await login({ intent: 'send-link', email: 'stranger@example.com' })).toEqual({
      step: 'link-sent',
      email: 'stranger@example.com',
    });
  });
});
