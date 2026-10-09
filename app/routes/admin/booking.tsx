import { Mail, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { data, useFetcher, useLocation, useNavigate } from 'react-router';

import {
  ActionToast,
  Eyebrow,
  StatusPill,
  getBookingDisplayStatus,
  outlineButtonClass,
  primaryButtonClass,
} from '~/components/admin/primitives';
import {
  cancelBookingAsOperator,
  getBookingForOperator,
  markBookingRefunded,
  restartBookingRefund,
} from '~/lib/bookings';
import { sendBookingCancellationRefundRequestedCommunication } from '~/lib/email';
import { refundPayPalCapture } from '~/lib/paypal';
import { cn } from '~/lib/utils';

import type { Route } from './+types/booking';

export async function loader({ params }: Route.LoaderArgs) {
  const res = await getBookingForOperator(params.bookingId);

  if (!res?.tour) throw data('Booking not found', { status: 404 });

  return res as typeof res & { tour: NonNullable<typeof res.tour> };
}

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requestRefund(captureId: string, requestId?: string) {
  const refund = await refundPayPalCapture(captureId, requestId);

  if (refund.status !== 'COMPLETED' && refund.status !== 'PENDING') {
    throw new Error(`PayPal refund returned ${refund.status}`);
  }

  return refund;
}

export async function action({
  request,
  params,
}: Route.ActionArgs): Promise<ActionResult> {
  const intent = (await request.formData()).get('intent');
  const res = await getBookingForOperator(params.bookingId);

  if (!res?.tour) throw data('Booking not found', { status: 404 });

  const { booking, tour, total } = res;
  const communication = {
    to: booking.bookerEmail,
    bookerName: booking.bookerName,
    tourName: tour.name,
    date: booking.date,
    time: booking.time,
    guests: booking.guests,
    total,
  };

  if (intent === 'mark-refunded') {
    if (booking.paymentStatus !== 'refund_failed') {
      return { ok: false, error: 'Only a failed refund can be marked as refunded.' };
    }

    await markBookingRefunded(booking._id);
    return { ok: true, message: 'Marked as refunded' };
  }

  const retry = intent === 'retry-refund';

  if (!retry && intent !== 'cancel') {
    return { ok: false, error: 'Unknown action.' };
  }

  const refundable = retry
    ? booking.cancelled && booking.paymentStatus === 'refund_failed'
    : !booking.cancelled && booking.paymentStatus === 'paid';

  if (!booking.paypalCaptureId || !refundable) {
    return { ok: false, error: 'This Booking can’t be refunded from here.' };
  }

  let refund: Awaited<ReturnType<typeof requestRefund>>;

  try {
    refund = await requestRefund(
      booking.paypalCaptureId,
      // A new request ID per failed refund, so PayPal makes a fresh attempt instead of replaying the failure.
      retry ? `refund-${booking.paypalCaptureId}-${booking.paypalRefundId}` : undefined,
    );
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: 'PayPal didn’t accept the refund. Nothing changed. Try again or refund in PayPal.',
    };
  }

  if (retry) {
    await restartBookingRefund({ id: booking._id, paypalRefundId: refund.id });
  } else {
    await cancelBookingAsOperator({ id: booking._id, paypalRefundId: refund.id });
  }

  await sendBookingCancellationRefundRequestedCommunication(communication, {
    bookingId: booking._id,
  });

  return {
    ok: true,
    message: retry ? 'Refund requested again' : `Canceled and refunded ${booking.bookerName}`,
  };
}

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function AdminBooking({ loaderData }: Route.ComponentProps) {
  const { booking, tour, total } = loaderData;
  const navigate = useNavigate();
  const { search } = useLocation();
  const fetcher = useFetcher<typeof action>();
  const [confirming, setConfirming] = useState(false);

  const close = () => navigate(`/admin/bookings${search}`);
  const busy = fetcher.state !== 'idle';
  const status = getBookingDisplayStatus(booking);
  const firstName = booking.bookerName.split(' ')[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div
        onClick={close}
        className='fixed inset-0 z-40 bg-primary/20 animate-in fade-in duration-200 ease-out'
      />
      <aside
        aria-label={`Booking for ${booking.bookerName}`}
        className='fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-full flex-col border-l border-border bg-card shadow-xl animate-in slide-in-from-right duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none'
      >
        <div className='flex items-start justify-between border-b border-border p-5'>
          <div className='min-w-0'>
            <Eyebrow className='break-all'>Booking {booking._id}</Eyebrow>
            <h2 className='mt-1 text-2xl font-medium'>{booking.bookerName}</h2>
            <a
              href={`mailto:${booking.bookerEmail}`}
              className='text-sm text-muted-foreground hover:text-primary hover:underline'
            >
              {booking.bookerEmail}
            </a>
          </div>
          <button
            type='button'
            onClick={close}
            aria-label='Close'
            className='flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
          >
            <X className='size-4' />
          </button>
        </div>

        <div className='grid gap-5 overflow-y-auto p-5'>
          <StatusPill booking={booking} />
          <div className='flex gap-3'>
            <img src={tour.imageUrl} alt='' className='size-16 rounded-md object-cover' />
            <div>
              <Eyebrow>{tour.category}</Eyebrow>
              <p className='mt-0.5 font-medium leading-tight'>{tour.name}</p>
            </div>
          </div>
          <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
            {[
              ['Date', formatLongDate(booking.date)],
              ['Time', booking.time],
              ['Guests', String(booking.guests)],
              ['Total paid', `$${total}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className='text-xs text-muted-foreground'>{label}</dt>
                <dd className='font-medium'>{value}</dd>
              </div>
            ))}
            <div className='col-span-2'>
              <dt className='text-xs text-muted-foreground'>Meeting point</dt>
              <dd className='font-medium'>{tour.meetingPoint}</dd>
            </div>
          </dl>

          {status === 'refund_pending' && (
            <p className='rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground'>
              Canceled. Waiting for PayPal to confirm the ${total} refund.
            </p>
          )}

          {status === 'refunded' && (
            <p className='rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground'>
              Canceled and refunded ${total}.
            </p>
          )}

          {status === 'refund_failed' && (
            <div className='grid gap-2'>
              <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                The Booking is canceled, but PayPal rejected the ${total} refund. {firstName} got
                an email saying we&apos;re on it.
              </p>
              <fetcher.Form method='post' className='flex gap-2'>
                <button
                  name='intent'
                  value='retry-refund'
                  disabled={busy}
                  className={primaryButtonClass}
                >
                  <RotateCcw className='size-3.5' /> Retry refund
                </button>
                <button
                  name='intent'
                  value='mark-refunded'
                  disabled={busy}
                  className={outlineButtonClass}
                >
                  I refunded in PayPal
                </button>
              </fetcher.Form>
            </div>
          )}

          {status === 'confirmed' &&
            (confirming ? (
              <fetcher.Form
                method='post'
                onSubmit={() => setConfirming(false)}
                className='grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 animate-in fade-in duration-150'
              >
                <p className='text-sm'>
                  Refund <strong className='font-semibold'>${total}</strong> to {firstName}{' '}
                  through PayPal and email them the cancellation. This works inside the 24-hour
                  cutoff too.
                </p>
                <div className='flex gap-2'>
                  <button
                    name='intent'
                    value='cancel'
                    className={cn(
                      primaryButtonClass,
                      'bg-destructive hover:bg-destructive/85',
                    )}
                  >
                    <X className='size-3.5' /> Cancel and refund
                  </button>
                  <button
                    type='button'
                    onClick={() => setConfirming(false)}
                    className='inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  >
                    Keep Booking
                  </button>
                </div>
              </fetcher.Form>
            ) : (
              <div className='flex gap-2'>
                <a href={`mailto:${booking.bookerEmail}`} className={outlineButtonClass}>
                  <Mail className='size-3.5' /> Email {firstName}
                </a>
                <button
                  type='button'
                  disabled={busy || !booking.paypalCaptureId}
                  onClick={() => setConfirming(true)}
                  className='inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40'
                >
                  <X className='size-3.5' /> {busy ? 'Refunding…' : 'Cancel and refund'}
                </button>
              </div>
            ))}
        </div>
      </aside>
      <ActionToast result={fetcher.data} />
    </>
  );
}
