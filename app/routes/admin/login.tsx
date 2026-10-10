import { useState } from 'react';
import { Form, Link, redirect, useNavigation } from 'react-router';
import { z } from 'zod';

import {
  Eyebrow,
  fieldClass,
  labelClass,
  outlineButtonClass,
  primaryButtonClass,
} from '~/components/admin/primitives';
import { convexAuthAction, convexQuery } from '~/lib/convex.server';
import {
  getOperatorReturnPath,
  getOperatorSession,
  serializeOperatorSession,
  type OperatorTokens,
} from '~/lib/operator-session.server';
import { cn } from '~/lib/utils';

import { api } from '../../../convex/_generated/api';
import type { Route } from './+types/login';

type Mode = 'sign-in' | 'sign-up' | 'link';

const EmailField = z.string().trim().toLowerCase().email();

export function meta() {
  return [
    { title: 'Sign in · Operator · Cinematic Sites of Savannah' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { operator } = await getOperatorSession(request);
  const { searchParams } = new URL(request.url);
  const redirectTo = getOperatorReturnPath(searchParams.get('redirectTo'));

  if (operator) throw redirect(redirectTo);

  // `code` is set when the Operator opens a magic link.
  return { code: searchParams.get('code'), redirectTo };
}

function signIn(provider: string | undefined, params: Record<string, string>) {
  return convexAuthAction(api.auth.signIn, { provider, params });
}

async function startSession(tokens: OperatorTokens, redirectTo: string) {
  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await serializeOperatorSession(tokens) },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get('intent');
  const email = EmailField.safeParse(form.get('email')).data ?? '';
  const field = (name: string) => String(form.get(name) ?? '').trim();
  const redirectTo = getOperatorReturnPath(form.get('redirectTo'));

  if (intent === 'link-sign-in') {
    const result = await signIn(undefined, { code: field('code') }).catch(() => null);

    if (result?.tokens) return startSession(result.tokens, redirectTo);

    return { mode: 'link' as const, error: 'This sign-in link expired or was already used. Request a new one.' };
  }

  if (!email) return { mode: undefined, error: 'Enter a valid email.' };

  if (intent === 'send-link') {
    // Same answer whether or not the email is on the operator list.
    const linkTarget = `/admin/login?${new URLSearchParams({ redirectTo })}`;

    await signIn('magic-link', { email, redirectTo: linkTarget }).catch((error) =>
      console.error('Could not send an Operator sign-in link', error),
    );

    return { step: 'link-sent' as const, email };
  }

  if (intent === 'verify-code') {
    const result = await signIn('password', {
      flow: 'email-verification',
      email,
      code: field('code'),
    }).catch(() => null);

    if (result?.tokens) return startSession(result.tokens, redirectTo);

    return { step: 'code' as const, email, error: "That code didn't work. Check it and try again." };
  }

  const password = String(form.get('password') ?? '');

  if (intent === 'sign-up') {
    const name = field('name');

    if (!name) return { mode: 'sign-up' as const, error: 'Enter your name.' };
    if (password.length < 8)
      return { mode: 'sign-up' as const, error: 'Use a password with at least 8 characters.' };

    const result = await signIn('password', { flow: 'signUp', email, password, name }).catch(
      () => null,
    );

    // Signing up again with an existing account's password signs in, with no code sent.
    if (result?.tokens) return startSession(result.tokens, redirectTo);

    if (!result) {
      const exists = await convexQuery(api.operators.hasPasswordAccount, { email }).catch(
        () => false,
      );

      return {
        mode: 'sign-up' as const,
        error: exists
          ? 'An account already exists for this email. Sign in instead.'
          : "Couldn't create that account. Only emails on the operator list can sign up.",
      };
    }

    // A new password account gets a session only after its email code is entered.
    return { step: 'code' as const, email };
  }

  const result = await signIn('password', { flow: 'signIn', email, password }).catch(
    () => null,
  );

  if (result?.tokens) return startSession(result.tokens, redirectTo);
  // Accounts that never confirmed their email get a fresh code instead of a session.
  if (result) return { step: 'code' as const, email };

  return { mode: 'sign-in' as const, error: "That email and password don't match an operator account." };
}

export default function OperatorLogin({ loaderData, actionData }: Route.ComponentProps) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const busy = useNavigation().state !== 'idle';
  const step = actionData && 'step' in actionData ? actionData : null;
  const error = actionData?.error;

  let content: React.ReactNode;

  if (step?.step === 'link-sent') {
    content = (
      <>
        <Heading
          title='Check your email'
          description={`If ${step.email} is on the operator list, a sign-in link is on its way. It expires in 1 hour.`}
        />
        <Link to='/admin/login' className={outlineButtonClass}>
          Use a different email
        </Link>
      </>
    );
  } else if (step?.step === 'code') {
    content = (
      <Form method='post' className='grid gap-4'>
        <Heading
          title='Enter your code'
          description={`We emailed an 8-digit code to ${step.email}. It expires in 15 minutes.`}
        />
        <input type='hidden' name='intent' value='verify-code' />
        <input type='hidden' name='redirectTo' value={loaderData.redirectTo} />
        <input type='hidden' name='email' value={step.email} />
        <label className='grid gap-1.5'>
          <span className={labelClass}>Code</span>
          <input
            name='code'
            required
            inputMode='numeric'
            autoComplete='one-time-code'
            pattern='[0-9]{8}'
            className={cn(fieldClass, 'font-mono tracking-[0.3em]')}
          />
        </label>
        <ErrorText error={error} />
        <button type='submit' disabled={busy} className={primaryButtonClass}>
          Continue
        </button>
      </Form>
    );
  } else if (loaderData.code) {
    content = (
      <Form method='post' className='grid gap-4'>
        <Heading
          title='Finish signing in'
          description='Continue to open the operator console in this browser.'
        />
        <input type='hidden' name='intent' value='link-sign-in' />
        <input type='hidden' name='redirectTo' value={loaderData.redirectTo} />
        <input type='hidden' name='code' value={loaderData.code} />
        <ErrorText error={error} />
        <button type='submit' disabled={busy} className={primaryButtonClass}>
          Sign in
        </button>
        {error && (
          <Link to='/admin/login' className={outlineButtonClass}>
            Request a new link
          </Link>
        )}
      </Form>
    );
  } else {
    content = (
      <>
        <div className='grid grid-cols-2 gap-1 rounded-lg bg-muted p-1'>
          {(
            [
              ['sign-in', 'Password'],
              ['link', 'Email link'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type='button'
              onClick={() => setMode(value)}
              className={cn(
                'h-8 rounded-md text-sm font-medium transition-colors',
                (mode === value || (value === 'sign-in' && mode === 'sign-up'))
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Form method='post' className='grid gap-4'>
          <input
            type='hidden'
            name='intent'
            value={mode === 'link' ? 'send-link' : mode}
          />
          <input type='hidden' name='redirectTo' value={loaderData.redirectTo} />
          {mode === 'sign-up' && (
            <label className='grid gap-1.5'>
              <span className={labelClass}>Name</span>
              <input name='name' required autoComplete='name' className={fieldClass} />
            </label>
          )}
          <label className='grid gap-1.5'>
            <span className={labelClass}>Email</span>
            <input
              type='email'
              name='email'
              required
              autoComplete='email'
              className={fieldClass}
            />
          </label>
          {mode !== 'link' && (
            <label className='grid gap-1.5'>
              <span className={labelClass}>Password</span>
              <input
                type='password'
                name='password'
                required
                minLength={mode === 'sign-up' ? 8 : undefined}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                className={fieldClass}
              />
            </label>
          )}
          <ErrorText error={actionData?.mode === mode || !actionData?.mode ? error : undefined} />
          <button type='submit' disabled={busy} className={primaryButtonClass}>
            {mode === 'sign-up' ? 'Create account' : mode === 'link' ? 'Email me a link' : 'Sign in'}
          </button>
        </Form>
        {mode !== 'link' && (
          <p className='text-center text-sm text-muted-foreground'>
            {mode === 'sign-up' ? 'Already have an account?' : 'New operator?'}{' '}
            <button
              type='button'
              onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
              className='font-medium text-primary hover:underline'
            >
              {mode === 'sign-up' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}
      </>
    );
  }

  return (
    <main className='flex min-h-screen flex-col bg-muted/50'>
      <div className='h-2 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-repeat-x' />
      <div className='mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12'>
        <div className='mb-8 text-center'>
          <img
            src='/logo.png'
            alt='Cinematic Sites of Savannah'
            className='mx-auto h-20 w-auto'
          />
          <Eyebrow className='mt-4'>Operator</Eyebrow>
        </div>
        <div className='grid gap-5 rounded-xl border border-border bg-card p-6'>{content}</div>
      </div>
    </main>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className='text-lg font-medium'>{title}</h1>
      <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;

  return (
    <p role='alert' className='text-sm text-destructive'>
      {error}
    </p>
  );
}
