import { Star, Users, Clock, Check } from 'lucide-react';

import { Stepper } from '~/components/stepper.js';
import { tours } from '~/lib/mock-data';

export default function Tour() {
  const tour = tours[3];

  return (
    <main className='mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8'>
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

        <Stepper
          tourStartTimes={tour.startTimes}
          tourPrice={tour.price}
          tourMaxGuests={tour.maxGuests}
          tourName={tour.name}
        />
      </div>
    </main>
  );
}
