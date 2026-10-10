import { createContext, createCookie, redirect } from 'react-router';
import type { MiddlewareFunction } from 'react-router';
import type { FunctionReturnType } from 'convex/server';

import { convexAuthAction, convexQuery } from '~/lib/convex.server';

import { api } from '../../convex/_generated/api';

export type OperatorTokens = { token: string; refreshToken: string };
export type Operator = NonNullable<
  FunctionReturnType<typeof api.operators.getSignedInOperator>
>;

const sessionCookie = createCookie('operator_session', {
  // Not '/admin': cookie paths don't match React Router's `/admin.data` requests.
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  // Convex Auth sessions last 30 days by default.
  maxAge: 60 * 60 * 24 * 30,
});

// When this browser last marked Recent activity as seen. Per browser, not per Operator.
const activitySeenCookie = createCookie('operator_activity_seen', {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
});

export const operatorContext = createContext<Operator>();
// Set by loadOperator on pages outside the console. Null when nobody is signed in.
export const optionalOperatorContext = createContext<Operator | null>(null);

export async function readActivitySeenAt(request: Request) {
  return Number(await activitySeenCookie.parse(request.headers.get('Cookie'))) || 0;
}

export function serializeActivitySeenAt(seenAt: number) {
  return activitySeenCookie.serialize(seenAt);
}

// Where to go after sign-in. Only console pages, so the login can't bounce anywhere else.
export function getOperatorReturnPath(redirectTo: unknown) {
  return typeof redirectTo === 'string' && /^\/admin\/(?!\/)/.test(redirectTo)
    ? redirectTo
    : '/admin';
}

export function serializeOperatorSession(tokens: OperatorTokens | null) {
  return tokens
    ? sessionCookie.serialize(tokens)
    : sessionCookie.serialize('', { maxAge: 0 });
}

export async function readOperatorTokens(request: Request) {
  const tokens = (await sessionCookie.parse(request.headers.get('Cookie'))) as
    | Partial<OperatorTokens>
    | null;

  return tokens?.token && tokens.refreshToken ? (tokens as OperatorTokens) : null;
}

function expiresAt(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return Number(payload.exp) * 1000 || 0;
  } catch {
    return 0;
  }
}

// The signed-in Operator, swapping the refresh token for a new JWT when the current one
// is within a minute of expiring. `refreshed` means the cookie needs rewriting.
export async function getOperatorSession(request: Request) {
  let tokens = await readOperatorTokens(request);
  let refreshed = false;

  if (tokens && expiresAt(tokens.token) - Date.now() < 60_000) {
    const result = await convexAuthAction(api.auth.signIn, {
      refreshToken: tokens.refreshToken,
    }).catch(() => null);
    tokens = result?.tokens ?? null;
    refreshed = true;
  }

  const operator = tokens
    ? await convexQuery(api.operators.getSignedInOperator, {}, tokens.token).catch(
        (error) => {
          console.error('Could not load the signed-in Operator', error);
          return null;
        },
      )
    : null;

  return { operator, tokens: operator ? tokens : null, refreshed };
}

export const requireOperator: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const { operator, tokens, refreshed } = await getOperatorSession(request);

  if (!operator) {
    const { pathname, search } = new URL(request.url);
    const returnTo = pathname === '/admin' ? '' : `?${new URLSearchParams({ redirectTo: pathname + search })}`;

    throw redirect(`/admin/login${returnTo}`, {
      headers: { 'Set-Cookie': await serializeOperatorSession(null) },
    });
  }

  context.set(operatorContext, operator);

  const response = await next();

  if (refreshed) response.headers.append('Set-Cookie', await serializeOperatorSession(tokens));

  return response;
};

// Like requireOperator, but lets everyone through. Skips Convex when there's no session cookie.
export const loadOperator: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  if (!(await readOperatorTokens(request))) return next();

  const { operator, tokens, refreshed } = await getOperatorSession(request);
  context.set(optionalOperatorContext, operator);

  const response = await next();

  // Refresh tokens are single-use, so a rotated session has to reach the cookie.
  if (refreshed) response.headers.append('Set-Cookie', await serializeOperatorSession(tokens));

  return response;
};
