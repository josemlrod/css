import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import {
  ActionToast,
  Eyebrow,
  PageHeader,
  fieldClass,
  labelClass,
  outlineButtonClass,
  primaryButtonClass,
} from '~/components/admin/primitives';
import {
  TourSettingsValidation,
  isTourReady,
  timeToMinutes,
  toTourStartTime,
} from '~/lib/operator';
import { convexMutation, convexQuery } from '~/lib/convex.server';
import type { Tour, TourId } from '~/lib/types';
import { cn } from '~/lib/utils';

import { api } from '../../../convex/_generated/api';
import type { Route } from './+types/tours';

export async function loader() {
  return { tours: await convexQuery(api.tours.getTours, {}) };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const settings = TourSettingsValidation.safeParse({
    price: formData.get('price'),
    maxGuests: formData.get('maxGuests'),
    startTimes: formData.getAll('startTimes'),
    meetingPoint: formData.get('meetingPoint'),
  });

  if (!settings.success) {
    return { ok: false as const, error: 'Check the price, capacity, start times, and meeting point.' };
  }

  await convexMutation(api.tours.updateTourSettings, {
    id: String(formData.get('id')) as TourId,
    ...settings.data,
  });

  return { ok: true as const, message: `Saved ${formData.get('name')}` };
}

// Shared by every editor so the result toast outlives the editor that closes on save.
const SAVE_FETCHER_KEY = 'tour-settings';

export default function AdminTours({ loaderData }: Route.ComponentProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const saved = useFetcher<typeof action>({ key: SAVE_FETCHER_KEY });
  const wasSaving = useRef(false);

  // Close the editor once a save lands. The editor itself remounts when the saved tour revalidates.
  useEffect(() => {
    if (saved.state !== 'idle') {
      wasSaving.current = true;
    } else if (wasSaving.current) {
      wasSaving.current = false;
      if (saved.data?.ok) setEditing(null);
    }
  }, [saved.state, saved.data]);

  return (
    <>
      <PageHeader title='Tours' />
      <div className='grid gap-3'>
        {loaderData.tours.map((tour) => (
          <div key={tour._id} className='overflow-hidden rounded-xl border border-border bg-card'>
            <div className='flex items-center gap-4 p-4'>
              <img src={tour.imageUrl} alt='' className='size-14 rounded-md object-cover' />
              <div className='min-w-0 flex-1'>
                <Eyebrow>
                  {tour.category} · {tour.duration}
                </Eyebrow>
                <p className='mt-0.5 truncate font-medium'>{tour.name}</p>
                {!isTourReady(tour) && (
                  <p className='mt-1 inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive'>
                    <span className='size-1.5 rounded-full bg-destructive' />
                    Needs setup · hidden from Bookers
                  </p>
                )}
              </div>
              <dl className='hidden gap-6 text-sm lg:flex'>
                <div>
                  <dt className='text-xs text-muted-foreground'>Price</dt>
                  <dd className='font-medium tabular-nums'>${tour.price}</dd>
                </div>
                <div>
                  <dt className='text-xs text-muted-foreground'>Capacity</dt>
                  <dd className='font-medium tabular-nums'>{tour.maxGuests || '—'}</dd>
                </div>
                <div>
                  <dt className='text-xs text-muted-foreground'>Start times</dt>
                  <dd className='font-medium tabular-nums'>{tour.startTimes.join(', ') || '—'}</dd>
                </div>
              </dl>
              <button
                type='button'
                onClick={() => setEditing(editing === tour._id ? null : tour._id)}
                aria-expanded={editing === tour._id}
                className={outlineButtonClass}
              >
                {editing === tour._id ? 'Close' : 'Edit'}
              </button>
            </div>
            {editing === tour._id && (
              <div className='border-t border-border bg-muted/30 p-5 animate-in fade-in slide-in-from-top-1 duration-200 ease-out'>
                <TourEditor tour={tour} onCancel={() => setEditing(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
      <ActionToast result={saved.data} />
    </>
  );
}

function TourEditor({ tour, onCancel }: { tour: Tour; onCancel: () => void }) {
  const fetcher = useFetcher<typeof action>({ key: SAVE_FETCHER_KEY });
  const [price, setPrice] = useState(String(tour.price));
  // New tours are seeded with capacity 0, meaning not set. Start the field empty.
  const [maxGuests, setMaxGuests] = useState(tour.maxGuests ? String(tour.maxGuests) : '');
  const [startTimes, setStartTimes] = useState(tour.startTimes);
  const [meetingPoint, setMeetingPoint] = useState(tour.meetingPoint);
  const [newTime, setNewTime] = useState('');

  const dirty =
    Number(price) !== tour.price ||
    Number(maxGuests) !== tour.maxGuests ||
    meetingPoint !== tour.meetingPoint ||
    startTimes.join() !== tour.startTimes.join();

  function addTime() {
    if (!newTime) return;
    const time = toTourStartTime(newTime);
    if (!startTimes.includes(time)) {
      setStartTimes(
        [...startTimes, time].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
      );
    }
    setNewTime('');
  }

  return (
    <fetcher.Form method='post' className='grid gap-4'>
      <input type='hidden' name='id' value={tour._id} />
      <input type='hidden' name='name' value={tour.name} />
      {startTimes.map((time) => (
        <input key={time} type='hidden' name='startTimes' value={time} />
      ))}

      <div className='grid grid-cols-2 gap-3'>
        <label className='grid gap-1.5'>
          <span className={labelClass}>Price per guest</span>
          <div className='relative'>
            <span className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground'>
              $
            </span>
            <input
              type='number'
              name='price'
              min={1}
              step={0.01}
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={cn(fieldClass, 'pl-6 tabular-nums')}
            />
          </div>
        </label>
        <label className='grid gap-1.5'>
          <span className={labelClass}>Max guests per start time</span>
          <input
            type='number'
            name='maxGuests'
            min={1}
            step={1}
            required
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            className={cn(fieldClass, 'tabular-nums')}
          />
        </label>
      </div>

      <div className='grid gap-1.5'>
        <span className={labelClass}>Start times (Eastern)</span>
        <div className='flex flex-wrap items-center gap-1.5'>
          {startTimes.map((time) => (
            <span
              key={time}
              className='inline-flex h-8 items-center gap-1 rounded-full border border-border bg-secondary/25 pr-1 pl-3 text-sm tabular-nums'
            >
              {time}
              <button
                type='button'
                aria-label={`Remove ${time}`}
                onClick={() => setStartTimes(startTimes.filter((t) => t !== time))}
                className='flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground'
              >
                <X className='size-3' />
              </button>
            </span>
          ))}
          <span className='inline-flex items-center gap-1'>
            <input
              type='time'
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTime();
                }
              }}
              aria-label='New start time'
              className={cn(fieldClass, 'h-8 w-32 rounded-full')}
            />
            <button
              type='button'
              onClick={addTime}
              disabled={!newTime}
              className='inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted disabled:opacity-40'
            >
              <Plus className='size-3.5' /> Add
            </button>
          </span>
        </div>
        {startTimes.length === 0 && (
          <p className='text-xs text-destructive'>Add at least one start time.</p>
        )}
      </div>

      <label className='grid gap-1.5'>
        <span className={labelClass}>Meeting point</span>
        <input
          name='meetingPoint'
          required
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
          className={fieldClass}
        />
      </label>

      <p className='text-xs text-muted-foreground'>
        Changes apply to new checkouts. Existing Bookings keep their time, party size, and the
        price they paid.
      </p>

      <div className='flex justify-end gap-2'>
        <button
          type='button'
          onClick={onCancel}
          className='inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
        >
          Cancel
        </button>
        <button
          type='submit'
          disabled={!dirty || startTimes.length === 0 || fetcher.state !== 'idle'}
          className={primaryButtonClass}
        >
          {fetcher.state !== 'idle' ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </fetcher.Form>
  );
}
