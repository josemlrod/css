import { data } from 'react-router';

import {
  getCheckoutAttemptWithTour,
  verifyCheckoutAccessToken,
} from '~/lib/checkout-attempts';
import type { CheckoutAttempt, CheckoutAttemptId, Tour } from '~/lib/types';

import type { Route } from './+types/checkout-success';

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

export default function CheckoutSuccess({ loaderData }: Route.ComponentProps) {
  const { checkoutAttempt, tour } = loaderData;
  const expired = checkoutAttempt.expiresAt <= Date.now();
  const status = expired ? 'expired' : checkoutAttempt.paymentStatus;
  const total = checkoutAttempt.total;

  return (
    <main className='mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12'>
      <section className='w-full rounded-xl border border-border bg-white p-6 shadow-sm'>
        <p className='font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground'>
          Checkout status
        </p>
        <h1 className='mt-3 text-2xl font-medium tracking-tight'>
          {status === 'paid'
            ? 'Payment received'
            : status === 'expired'
              ? 'Checkout expired'
              : 'Payment processing'}
        </h1>
        <p className='mt-2 text-base text-muted-foreground'>
          {status === 'paid'
            ? 'Your paid Booking is being finalized from Stripe confirmation.'
            : status === 'expired'
              ? 'This Checkout Attempt expired before payment completed. No Booking was created.'
              : 'Stripe is confirming payment. Your Booking will be created after payment confirmation arrives.'}
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
          <div className='flex justify-between gap-4'>
            <dt className='text-muted-foreground'>Total paid</dt>
            <dd className='text-right font-medium'>${total}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
