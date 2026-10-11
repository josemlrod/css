import { data, Link } from 'react-router';

import { verifyAccessToken } from '~/lib/access-tokens';
import { convexQuery } from '~/lib/convex.server';
import { logEvent } from '~/lib/log';
import type { CheckoutAttempt, CheckoutAttemptId, Tour } from '~/lib/types';

import { api } from '../../convex/_generated/api';
import type { Route } from './+types/checkout-cancel';

export async function loader({ params, request }: Route.LoaderArgs) {
  const checkoutAttemptId = params.checkoutAttemptId as CheckoutAttemptId;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const res = await convexQuery(api.checkoutAttempts.getCheckoutAttemptWithTour, {
    checkoutAttemptId,
  });

  if (
    !res?.checkoutAttempt ||
    !res.tour ||
    !verifyAccessToken(token, res.checkoutAttempt.accessTokenHash)
  ) {
    logEvent('checkout.page_not_found', { page: 'cancel', checkoutAttemptId });
    throw data('Checkout not found', { status: 404 });
  }

  logEvent('checkout.paypal_canceled', {
    checkoutAttemptId,
    paymentStatus: res.checkoutAttempt.paymentStatus,
  });

  return res as { checkoutAttempt: CheckoutAttempt; tour: Tour };
}

export default function CheckoutCancel({ loaderData }: Route.ComponentProps) {
  const { checkoutAttempt, tour } = loaderData;

  return (
    <main className='mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12'>
      <section className='w-full rounded-xl border border-border bg-white p-6 shadow-sm'>
        <p className='font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground'>
          Checkout canceled
        </p>
        <h1 className='mt-3 text-2xl font-medium tracking-tight'>
          Your tour isn&apos;t booked
        </h1>
        <p className='mt-2 text-base text-muted-foreground'>
          You left PayPal before paying, so you weren&apos;t charged. Your spot
          isn&apos;t reserved until payment goes through.
        </p>

        <dl className='mt-6 space-y-3 rounded-lg bg-muted p-4 text-sm'>
          <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
            <dt className='text-muted-foreground'>Tour</dt>
            <dd className='min-w-0 break-words font-medium sm:text-right'>{tour.name}</dd>
          </div>
          <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
            <dt className='text-muted-foreground'>Date</dt>
            <dd className='min-w-0 break-words font-medium sm:text-right'>{checkoutAttempt.date}</dd>
          </div>
          <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
            <dt className='text-muted-foreground'>Time</dt>
            <dd className='min-w-0 break-words font-medium sm:text-right'>{checkoutAttempt.time}</dd>
          </div>
          <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
            <dt className='text-muted-foreground'>Guests</dt>
            <dd className='min-w-0 break-words font-medium sm:text-right'>{checkoutAttempt.guests}</dd>
          </div>
        </dl>

        <Link
          to={`/tour/${tour.slug}`}
          className='mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#bababa] bg-accent px-5 py-1.5 text-center font-heading text-xl font-semibold tracking-wide text-white transition-[color,background-color] duration-300 hover:bg-brand-teal hover:text-black sm:w-auto md:text-2xl'
        >
          Try booking again
        </Link>
      </section>
    </main>
  );
}
