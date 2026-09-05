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
  const status =
    checkoutAttempt.paymentStatus === 'pending' && expired
      ? 'expired'
      : checkoutAttempt.paymentStatus;
  const total = checkoutAttempt.total;
  let title = 'Payment processing';
  let message =
    'Your payment is still processing with PayPal. A Booking will be created once PayPal confirms the payment. Your tour is not reserved while payment is pending.';

  if (status === 'paid') {
    title = 'Payment received';
    message = 'PayPal confirmed your payment and your Booking is ready.';
  } else if (status === 'expired') {
    title = 'Checkout expired';
    message =
      'This Checkout Attempt expired before payment completed. No Booking was created.';
  } else if (status === 'failed') {
    title = 'Payment not completed';
    message = 'PayPal did not complete this payment. No Booking was created.';
  } else if (status === 'refund_pending') {
    title = 'Refund processing';
    message =
      'PayPal confirmed your payment, but capacity was no longer available. No Booking was created, and your full refund is processing.';
  } else if (status === 'refunded') {
    title = 'Payment refunded';
    message =
      'No Booking was created because capacity was no longer available. PayPal refunded your payment.';
  } else if (status === 'refund_failed') {
    title = 'Refund needs attention';
    message =
      'No Booking was created, and the automatic refund did not complete. Please contact CSS Tours for help.';
  }

  return (
    <main className='mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12'>
      <section className='w-full rounded-xl border border-border bg-white p-6 shadow-sm'>
        <p className='font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground'>
          Checkout status
        </p>
        <h1 className='mt-3 text-2xl font-medium tracking-tight'>
          {title}
        </h1>
        <p className='mt-2 text-base text-muted-foreground'>{message}</p>

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
          <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
            <dt className='text-muted-foreground'>Booking total</dt>
            <dd className='min-w-0 break-words font-medium sm:text-right'>${total}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
