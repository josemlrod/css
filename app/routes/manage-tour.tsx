import { useState } from 'react';
import { data, Link, redirect, useFetcher } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Users,
  MapPin,
  X,
  ShieldCheck,
  Mail,
} from 'lucide-react';

import { cancelPaidBooking, getBookingWithTourForAccess } from '~/lib/bookings';
import { hashCheckoutAccessToken } from '~/lib/checkout-attempts';
import {
  sendBookingCancellationRefundFailedCommunication,
  sendBookingCancellationRefundRequestedCommunication,
} from '~/lib/email';
import { createRefundForPaymentIntent } from '~/lib/stripe';

import type { Tour } from '~/lib/types';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import type { Route } from './+types/manage-tour';

type Booking = Doc<'bookings'>;

const View = {
  OVERVIEW: 'overview',
  CANCEL: 'cancel',
  CANCELLED: 'cancelled',
  CUTOFF_BLOCKED: 'cutoff_blocked',
  REFUND_FAILED: 'refund_failed',
} as const;
type ViewValues = (typeof View)[keyof typeof View];

export const formatLong = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

function tourStartAt(date: string, time: string) {
  return new Date(`${date} ${time}`).getTime();
}

function canSelfCancel(date: string, time: string) {
  return tourStartAt(date, time) - Date.now() > 24 * 60 * 60 * 1000;
}

const cancelReasons = [
  'Change of plans',
  'Found a different tour',
  'Weather concerns',
  'Booked by mistake',
  'Other',
];

export const manageCancellationCopy = {
  heading: 'manage cancellation',
  paymentStatus: 'Payment Status: refund pending',
} as const;

export default function ManageTour({ loaderData }: Route.ComponentProps) {
  const { booking, tour } = loaderData;
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state !== 'idle';
  const cancelled = booking.cancelled;

  const [view, setView] = useState<ViewValues>(
    cancelled ? View.CANCELLED : View.OVERVIEW,
  );
  const [reason, setReason] = useState<string | null>(null);

  const originalTotal = tour.price * booking.guests;
  const selfCancellationAllowed = canSelfCancel(booking.date, booking.time);

  return (
    <main>
      <div className='mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12'>
        <AnimatePresence mode='wait'>
          {!fetcher?.data?.view && view === View.OVERVIEW && (
            <motion.div
              key={View.OVERVIEW}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className='font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground'>
                Booking {booking._id}
              </p>
              <h1 className='mt-2 text-balance text-3xl font-medium tracking-tight md:text-4xl'>
                Hi {booking.bookerName.split(' ')[0]},{' '}
                {manageCancellationCopy.heading}.
              </h1>
              <p className='mt-2 max-w-xl text-sm text-muted-foreground'>
                You can cancel for a full refund until 24 hours before your tour.
                Inside 24 hours, contact support so we can help.
              </p>

              <BookingCard
                tour={tour}
                date={booking.date}
                time={booking.time}
                guests={booking.guests}
                status='confirmed'
                total={originalTotal}
              />

              {selfCancellationAllowed ? (
                <div className='mt-6 flex flex-col gap-2.5 sm:flex-row'>
                  <button
                    onClick={() => setView(View.CANCEL)}
                    className='inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  >
                    <X className='size-3.5' />
                    Cancel booking
                  </button>
                </div>
              ) : (
                <div className='mt-6 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground'>
                  This tour is inside the 24-hour cancellation cutoff. Contact
                  support for cancellation help.
                </div>
              )}

              <PolicyNote />
            </motion.div>
          )}

          {fetcher?.data?.view === View.CUTOFF_BLOCKED && (
            <ResultState
              key={View.CUTOFF_BLOCKED}
              icon={<ShieldCheck className='size-6 text-muted-foreground' />}
              title='Contact support'
              message='This tour is inside the 24-hour cancellation cutoff, so self-service cancellation is unavailable.'
              muted
            >
              <div className='rounded-lg border border-border bg-muted p-4 text-left text-sm text-muted-foreground'>
                Your Booking remains active. Contact support if you need help.
              </div>
            </ResultState>
          )}

          {fetcher?.data?.view === View.REFUND_FAILED && (
            <ResultState
              key={View.REFUND_FAILED}
              icon={<ShieldCheck className='size-6 text-muted-foreground' />}
              title='Refund needs support'
              message='We could not request your refund, so your Booking remains active.'
              muted
            >
              <div className='rounded-lg border border-border bg-muted p-4 text-left text-sm text-muted-foreground'>
                Please try again or contact support. We sent details to your inbox.
              </div>
            </ResultState>
          )}

          {!fetcher?.data?.view && view === View.CANCEL && (
            <motion.div
              key={View.CANCEL}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                onClick={() => setView('overview')}
                className='inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
              >
                <ArrowLeft className='size-3.5' />
                Back to booking
              </button>
              <h1 className='mt-3 text-balance text-3xl font-medium tracking-tight'>
                Cancel this booking?
              </h1>
              <p className='mt-2 max-w-xl text-sm text-muted-foreground'>
                Your tour is more than 24 hours away, so you&apos;re eligible
                for a full refund.
              </p>

              <div className='mt-6 flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4'>
                <ShieldCheck className='mt-0.5 size-4 shrink-0 text-accent' />
                <div className='text-sm'>
                  <p className='font-medium'>Full refund of ${originalTotal}</p>
                  <p className='mt-0.5 text-muted-foreground'>
                    Payment Status becomes refund pending after Stripe accepts
                    the refund request.
                  </p>
                </div>
              </div>

              <BookingCard
                tour={tour}
                date={booking.date}
                time={booking.time}
                guests={booking.guests}
                status='confirmed'
                total={originalTotal}
                compact
              />

              {/* Reason */}
              <section className='mt-6'>
                <p className='text-sm font-medium'>
                  Cancellation reason{' '}
                  <span className='font-normal text-muted-foreground/70'>
                    (optional)
                  </span>
                </p>
                <div className='mt-2.5 flex flex-wrap gap-1.5'>
                  {cancelReasons.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(reason === r ? null : r)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                        reason === r
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>

              <div className='mt-7 flex flex-col gap-2.5 sm:flex-row-reverse'>
                <button
                  disabled={isSubmitting}
                  onClick={() => {
                    fetcher.submit(booking, {
                      method: 'POST',
                      encType: 'application/json',
                    });
                  }}
                  className='inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-destructive bg-destructive px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-destructive/80'
                >
                  {isSubmitting ? null : <X className='size-3.5' />}
                  {isSubmitting ? 'Submitting...' : 'Confirm cancellation'}
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => setView('overview')}
                  className='inline-flex flex-1 items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                >
                  Keep my booking
                </button>
              </div>
            </motion.div>
          )}

          {(fetcher?.data?.view === View.CANCELLED ||
            view === View.CANCELLED) && (
            <ResultState
              key={View.CANCELLED}
              icon={<X className='size-6 text-muted-foreground' />}
              title='Booking Status: canceled'
              message={`${manageCancellationCopy.paymentStatus}. A refund of $${originalTotal} was requested for ${booking.bookerEmail}.`}
              muted
            >
              <div className='rounded-lg border border-border bg-muted p-4 text-left text-sm text-muted-foreground'>
                <p>
                  We&apos;re sorry to see this one go. When you&apos;re ready to
                  plan another visit, Savannah will be waiting under the oaks.
                </p>
              </div>
              <Link
                to='/v2/book'
                className='mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80'
              >
                Browse tours
              </Link>
            </ResultState>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export async function loader({ request, params: { bookingId } }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get('token');

  if (!token) throw redirect('/');

  const res = await getBookingWithTourForAccess(
    bookingId as Id<'bookings'>,
    hashCheckoutAccessToken(token),
  );

  if (!res?.booking || !res.tour) throw redirect('/');

  return res as { booking: Booking; tour: Tour };
}

export async function action({ request, params: { bookingId } }: Route.ActionArgs) {
  const token = new URL(request.url).searchParams.get('token');

  if (!token) return data({ view: View.CUTOFF_BLOCKED }, { status: 403 });

  const accessTokenHash = hashCheckoutAccessToken(token);
  const res = await getBookingWithTourForAccess(
    bookingId as Id<'bookings'>,
    accessTokenHash,
  );

  if (!res?.booking || !res.tour) {
    return data({ view: View.CUTOFF_BLOCKED }, { status: 403 });
  }

  const { booking, tour } = res;
  const total = tour.price * booking.guests;

  if (!canSelfCancel(booking.date, booking.time)) {
    return { view: View.CUTOFF_BLOCKED };
  }

  if (!booking.stripePaymentIntentId) {
    return { view: View.REFUND_FAILED };
  }

  let refund: { id: string };

  try {
    refund = await createRefundForPaymentIntent(booking.stripePaymentIntentId);
  } catch {
    await sendBookingCancellationRefundFailedCommunication({
      to: booking.bookerEmail,
      bookerName: booking.bookerName,
      tourName: tour.name,
      date: booking.date,
      time: booking.time,
      guests: booking.guests,
      total,
    });

    return { view: View.REFUND_FAILED };
  }

  await cancelPaidBooking({
    id: booking._id,
    accessTokenHash,
    stripeRefundId: refund.id,
  });

  await sendBookingCancellationRefundRequestedCommunication({
    to: booking.bookerEmail,
    bookerName: booking.bookerName,
    tourName: tour.name,
    date: booking.date,
    time: booking.time,
    guests: booking.guests,
    total,
  });

  return { view: View.CANCELLED };
}

function BookingCard({
  tour,
  date,
  time,
  guests,
  status,
  total,
  compact = false,
}: {
  tour: Tour;
  date: string;
  time: string;
  guests: number;
  status: 'confirmed' | 'cancelled';
  total: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? 'mt-5' : 'mt-7'} overflow-hidden rounded-xl border border-border bg-card text-card-foreground`}
    >
      <div className='flex flex-col sm:flex-row'>
        <div
          className={`relative ${compact ? 'h-28 sm:h-auto sm:w-36' : 'h-36 sm:h-auto sm:w-44'} sm:shrink-0`}
        >
          <img
            src={tour.imageUrl || '/placeholder.svg'}
            alt={tour.name}
            className='object-cover h-full'
          />
        </div>
        <div className='flex-1 p-4 md:p-5'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground'>
                {tour.category}
              </p>
              <h2 className='mt-1 text-balance text-lg font-medium leading-tight'>
                {tour.name}
              </h2>
            </div>
            <span className='inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground'>
              <span className='size-1.5 rounded-full bg-accent' />
              {status}
            </span>
          </div>
          <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm'>
            <Detail
              icon={<CalendarIcon className='size-3.5' />}
              label='Date'
              value={formatLong(date)}
            />
            <Detail
              icon={<Clock className='size-3.5' />}
              label='Time'
              value={time}
            />
            <Detail
              icon={<Users className='size-3.5' />}
              label='Guests'
              value={`${guests}`}
            />
            <Detail
              icon={<span className='text-xs font-medium tabular-nums'>$</span>}
              label='Total paid'
              value={`$${total}`}
            />
          </dl>
          {!compact && (
            <div className='mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground'>
              <MapPin className='size-3.5' />
              {tour.meetingPoint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className='flex items-start gap-2'>
      <span className='mt-0.5 flex size-4 items-center justify-center text-muted-foreground/80'>
        {icon}
      </span>
      <div>
        <dt className='text-[11px] text-muted-foreground'>{label}</dt>
        <dd className='font-medium leading-tight'>{value}</dd>
      </div>
    </div>
  );
}

function PolicyNote() {
  return (
    <div className='mt-6 flex items-start gap-2 text-xs text-muted-foreground'>
      <ShieldCheck className='mt-0.5 size-3.5 shrink-0 text-muted-foreground/80' />
      <p>
        Free cancellation up to 24 hours before your tour start time. This link
        is unique to your Booking — no sign-in needed.
      </p>
    </div>
  );
}

function ResultState({
  icon,
  title,
  message,
  muted = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className='mx-auto max-w-md text-center'
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 14,
          delay: 0.05,
        }}
        className={`mx-auto flex size-14 items-center justify-center rounded-full ${
          muted ? 'bg-muted' : 'bg-accent/15'
        }`}
      >
        {icon}
      </motion.div>
      <h1 className='mt-4 text-2xl font-medium tracking-tight'>{title}</h1>
      <p className='mx-auto mt-2 max-w-sm text-sm text-muted-foreground'>
        {message}
      </p>
      <div className='mt-6 text-left'>{children}</div>
      <p className='mt-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70'>
        <Mail className='size-3.5' />
        Check your inbox for details
      </p>
    </motion.div>
  );
}
