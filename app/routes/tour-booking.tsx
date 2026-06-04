import { data } from 'react-router';
import { Star, Users, Clock, Check } from 'lucide-react';

import { Stepper } from '~/components/stepper';
import { StepperProvider } from '~/components/stepper/stepper-context';
import { BookingValidation } from '~/lib/booking-validation';
import { sendBookingCommunication } from '~/lib/email';

import { tours } from '~/lib/mock-data';
import type { Route } from './+types/tour-booking';
import { saveBooking } from '~/lib/bookings';

export default function Tour({ loaderData }: Route.ComponentProps) {
  const { tour } = loaderData;

  return (
    <main className='mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8'>
      {/* Header */}
      <div className='mb-10 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500'>
            Tour · Food
          </p>
          <h1 className='mt-2 text-balance text-3xl font-medium tracking-tight md:text-4xl'>
            {tour.name}
          </h1>
          <p className='mt-2 max-w-xl text-stone-600'>{tour.description}</p>
        </div>
        <div className='flex items-center gap-4 text-xs text-stone-500'>
          <span className='inline-flex items-center gap-1'>
            <Star className='size-3.5 fill-[#D97757] stroke-[#D97757]' />
            <span className='font-medium text-stone-900'>{tour.rating}</span>
            <span>({tour.reviewCount})</span>
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
          <div className='relative  overflow-hidden rounded-lg bg-stone-100'>
            <img
              src={tour.image || '/placeholder.svg'}
              alt={tour.name}
              className='object-cover aspect-[4/5] animate-in fade-in duration-300'
            />
          </div>
          <div className='grid grid-cols-2 gap-3 text-xs'>
            <div className='rounded-md border border-stone-200 p-3'>
              <p className='text-stone-500'>Meeting point</p>
              <p className='mt-1 font-medium'>{tour.meetingPoint}</p>
            </div>
            <div className='rounded-md border border-stone-200 p-3'>
              <p className='text-stone-500'>Includes</p>
              <p className='mt-1 font-medium'>Six tastings, recipe card</p>
            </div>
          </div>
          <ul className='grid grid-cols-2 gap-1.5'>
            {tour.highlights.map((h) => (
              <li
                key={h}
                className='flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700'
              >
                <Check className='size-3 text-[#D97757]' />
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

  const tour = getTour(params.tourId);
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
      { ok: false, error: 'Unable to send booking communication' },
      { status: 500 },
    );
  }

  try {
    const bookingId = await saveBooking({
      date,
      time,
      guests,
      bookerName,
      bookerEmail,
    });
    await sendBookingCommunication({
      to: bookerEmail,
      bookerName,
      tourName: tour.name,
      date,
      time,
      guests,
      total: guests * tour.price,
      meetingPoint: tour.meetingPoint,
      editUrl: new URL(`/bookings/${bookingId}/edit`, origin).toString(),
      cancelUrl: new URL(`/bookings/${bookingId}/cancel`, origin).toString(),
    });
  } catch (error) {
    console.error(error);
    return data(
      { ok: false, error: 'Unable to send booking communication' },
      { status: 500 },
    );
  }

  return { ok: true };
}

export async function loader({ params }: Route.LoaderArgs) {
  return { tour: getTour(params.tourId) };
}
