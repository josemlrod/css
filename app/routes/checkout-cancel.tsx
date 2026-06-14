import { data, Link } from 'react-router';

import {
  getCheckoutAttemptWithTour,
  verifyCheckoutAccessToken,
} from '~/lib/checkout-attempts';
import type { CheckoutAttempt, CheckoutAttemptId, Tour } from '~/lib/types';

import type { Route } from './+types/checkout-cancel';

export async function loader({ params, request }: Route.LoaderArgs) {
  const checkoutAttemptId = params.checkoutAttemptId as CheckoutAttemptId;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const res = await getCheckoutAttemptWithTour(checkoutAttemptId);

  if (
    !res?.checkoutAttempt ||
    !res.tour ||
    !verifyCheckoutAccessToken(token, res.checkoutAttempt.accessTokenHash)
  ) {
    throw data('Checkout not found', { status: 404 });
  }

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
          No Booking was created
        </h1>
        <p className='mt-2 text-base text-muted-foreground'>
          Payment did not complete for this Checkout Attempt. Your card was not charged by this app, and no Booking was created.
        </p>

        <dl className='mt-6 space-y-3 rounded-lg bg-muted p-4 text-sm'>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>Tour</dt>
            <dd className='text-right font-medium'>{tour.name}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>Date</dt>
            <dd className='text-right font-medium'>{checkoutAttempt.date}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>Time</dt>
            <dd className='text-right font-medium'>{checkoutAttempt.time}</dd>
          </div>
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>Guests</dt>
            <dd className='text-right font-medium'>{checkoutAttempt.guests}</dd>
          </div>
        </dl>

        <Link
          to={`/tour/${tour._id}`}
          className='mt-6 inline-flex rounded-full border border-[#bababa] bg-accent px-5 py-1.5 font-heading text-xl font-semibold tracking-wide text-white transition-[color,background-color] duration-300 hover:bg-brand-teal hover:text-black md:text-2xl'
        >
          Start a new Checkout Attempt
        </Link>
      </section>
    </main>
  );
}
