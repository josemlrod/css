import { data, redirect } from 'react-router';
import { Star, Users, Clock, Check } from 'lucide-react';

import { Stepper } from '~/components/stepper';
import { StepperProvider } from '~/components/stepper/stepper-context';
import { BookingValidation } from '~/lib/booking-validation';

import { tours } from '~/lib/mock-data';
import type { Route } from './+types/tour-booking';
import {
  saveCheckoutAttempt,
  updateCheckoutAttempt,
} from '~/lib/checkout-attempts';
import { createCheckoutSession } from '~/lib/stripe';
import { getTourById } from '~/lib/tours';
import type { TourId, Tour as TourType } from '~/lib/types';

export default function Tour({ loaderData }: Route.ComponentProps) {
  const { tour } = loaderData;

  return (
    <main className='mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8'>
      {/* Header */}
      <div className='mb-10 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground'>
            Tour · Food
          </p>
          <h1 className='mt-2 text-balance text-3xl font-medium tracking-tight md:text-4xl'>
            {tour.name}
          </h1>
          <p className='mt-2 max-w-xl text-base text-muted-foreground'>{tour.description}</p>
        </div>
        <div className='flex items-center gap-4 text-sm text-muted-foreground'>
          <span className='inline-flex items-center gap-1'>
            <Star className='size-3.5 fill-accent stroke-accent' />
            <span className='font-medium text-foreground'>5</span>
            <span>(500)</span>
          </span>
          <span className='inline-flex items-center gap-1'>
            <Clock className='size-3.5' /> {tour.duration}
          </span>
          <span className='inline-flex items-center gap-1'>
            <Users className='size-3.5' /> Max {tour.maxGuests}
          </span>
        </div>
      </div>

      <div className='grid gap-10 lg:grid-cols-[1fr_1fr]'>
        {/* Image side */}
        <div className='space-y-4'>
          <div className='relative  overflow-hidden rounded-lg bg-muted'>
            <img
              src={tour.imageUrl || '/placeholder.svg'}
              alt={tour.name}
              className='object-cover aspect-[4/5] animate-in fade-in duration-300'
            />
          </div>
          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div className='rounded-md border border-border p-3'>
              <p className='text-muted-foreground'>Meeting point</p>
              <p className='mt-1 font-medium'>{tour.meetingPoint}</p>
            </div>
            <div className='rounded-md border border-border p-3'>
              <p className='text-muted-foreground'>Includes</p>
              <p className='mt-1 font-medium'>Six tastings, recipe card</p>
            </div>
          </div>
          <ul className='grid grid-cols-2 gap-1.5'>
            {tour.highlights.map((h) => (
              <li
                key={h}
                className='flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground'
              >
                <Check className='size-3 text-accent' />
                {h}
              </li>
            ))}
          </ul>
        </div>

        <StepperProvider>
          <Stepper />
        </StepperProvider>
      </div>
    </main>
  );
}

function getTour(tourId: string | undefined) {
  const tour = tours.find((t) => t.id === tourId || t.slug === tourId);

  if (!tour) {
    throw data('Tour not found', { status: 404 });
  }

  return tour;
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  if (formData.get('intent') !== 'confirm-booking') {
    return data({ ok: false, error: 'Invalid intent' }, { status: 400 });
  }

  const tourId = params.tourId as TourId;

  const tour = (await getTourById(tourId)) as TourType;
  const booking = BookingValidation.safeParse({
    date: String(formData.get('date') ?? ''),
    time: String(formData.get('time') ?? ''),
    guests: Number(formData.get('guests')),
    bookerName: String(formData.get('name') ?? ''),
    bookerEmail: String(formData.get('email') ?? ''),
  });

  if (
    !booking.success ||
    !tour.startTimes.includes(booking.data.time) ||
    booking.data.guests > tour.maxGuests
  ) {
    return data(
      { ok: false, error: 'Invalid booking details' },
      { status: 400 },
    );
  }

  const { date, time, guests, bookerName, bookerEmail } = booking.data;

  const origin = process.env.APP_ORIGIN;

  if (!origin) {
    console.error(new Error('APP_ORIGIN is required'));
    return data(
      { ok: false, error: 'Unable to start checkout' },
      { status: 500 },
    );
  }

  try {
    const { checkoutAttemptId, accessToken, expiresAt } =
      await saveCheckoutAttempt({
        date,
        time,
        guests,
        bookerName,
        bookerEmail,
        tourId,
        unitPrice: tour.price,
        total: guests * tour.price,
        currency: 'usd',
      });

    const session = await createCheckoutSession({
      checkoutAttemptId,
      accessToken,
      expiresAt,
      origin,
      tour,
      date,
      time,
      guests,
      bookerEmail,
    });

    if (!session.url) {
      throw new Error('Stripe Checkout Session URL is required');
    }

    await updateCheckoutAttempt({
      id: checkoutAttemptId,
      stripeCheckoutSessionId: session.id,
    });

    throw redirect(session.url);
  } catch (error) {
    if (error instanceof Response) throw error;

    console.error(error);
    return data({ ok: false, error: 'Unable to start checkout' }, { status: 500 });
  }
}

export async function loader({ params: { tourId } }: Route.LoaderArgs) {
  const tour = await getTourById(tourId as TourId);

  if (!tour) throw data('Tour not found', { status: 404 });

  return { tour } as { tour: TourType };
}
