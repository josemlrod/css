import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Link, useFetcher } from 'react-router';

import {
  ActionToast,
  PageHeader,
  fieldClass,
  labelClass,
  outlineButtonClass,
  primaryButtonClass,
} from '~/components/admin/primitives';
import { listBookingsForOperator } from '~/lib/bookings';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import {
  BlockedDateValidation,
  countActiveBookingsByDate,
  groupUpcomingClosedDates,
} from '~/lib/operator';
import { getTours, setTourDateBlocked } from '~/lib/tours';
import type { TourId } from '~/lib/types';

import type { Route } from './+types/closed-dates';
import { formatShortDate } from './bookings';

// Shared so the result toast survives the list re-rendering after a reopen.
const FETCHER_KEY = 'closed-dates';

export async function loader() {
  const today = getTodayInBookingTimeZone();
  const [tours, bookings] = await Promise.all([getTours(), listBookingsForOperator()]);

  return {
    today,
    tours: tours.map(({ _id, name }) => ({ _id, name })),
    closedDates: groupUpcomingClosedDates(tours, today),
    activeCounts: countActiveBookingsByDate(bookings, today),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const blocked = formData.get('intent') === 'close';
  const input = BlockedDateValidation.safeParse({
    date: formData.get('date'),
    tourIds: formData.getAll('tourIds'),
    blocked,
  });

  if (!input.success || (blocked && input.data.date < getTodayInBookingTimeZone())) {
    return { ok: false as const, error: 'Pick today or a future date and at least one tour.' };
  }

  await setTourDateBlocked({
    ...input.data,
    tourIds: input.data.tourIds as TourId[],
  });

  return {
    ok: true as const,
    message: `${blocked ? 'Closed' : 'Reopened'} ${formatShortDate(input.data.date)}`,
  };
}

export default function AdminClosedDates({ loaderData }: Route.ComponentProps) {
  const { today, tours, closedDates, activeCounts } = loaderData;
  const fetcher = useFetcher<typeof action>({ key: FETCHER_KEY });
  const [date, setDate] = useState('');
  const [scope, setScope] = useState('all');

  const scopeIds = scope === 'all' ? tours.map((tour) => tour._id) : [scope];
  const tourNames = new Map<string, string>(tours.map((tour) => [tour._id, tour.name]));

  function activeOn(day: string, tourIds: string[]) {
    return tourIds.reduce(
      (sum, id) => {
        const count = activeCounts[day]?.[id];
        return {
          bookings: sum.bookings + (count?.bookings ?? 0),
          guests: sum.guests + (count?.guests ?? 0),
        };
      },
      { bookings: 0, guests: 0 },
    );
  }

  const affected = date ? activeOn(date, scopeIds) : { bookings: 0, guests: 0 };
  const busy = fetcher.state !== 'idle';

  return (
    <>
      <PageHeader title='Closed dates' />
      <div className='grid gap-6 lg:grid-cols-[360px_1fr]'>
        <fetcher.Form
          method='post'
          className='grid h-fit gap-4 rounded-xl border border-border bg-card p-5'
          onSubmit={() => setDate('')}
        >
          <input type='hidden' name='intent' value='close' />
          {scopeIds.map((id) => (
            <input key={id} type='hidden' name='tourIds' value={id} />
          ))}
          <div>
            <h2 className='text-lg font-medium'>Close a date</h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              Bookers can&apos;t start a checkout for a closed date.
            </p>
          </div>
          <label className='grid gap-1.5'>
            <span className={labelClass}>Date</span>
            <input
              type='date'
              name='date'
              min={today}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className='grid gap-1.5'>
            <span className={labelClass}>Tours</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={fieldClass}
            >
              <option value='all'>All tours</option>
              {tours.map((tour) => (
                <option key={tour._id} value={tour._id}>
                  {tour.name}
                </option>
              ))}
            </select>
          </label>
          {affected.bookings > 0 && (
            <div className='flex gap-2 rounded-md bg-accent/10 p-3 text-sm'>
              <AlertTriangle className='mt-0.5 size-4 shrink-0 text-accent' />
              <p>
                {affected.bookings} Booking{affected.bookings > 1 && 's'} ({affected.guests}{' '}
                guests) already on this date stay booked. Cancel them separately if the tour
                won&apos;t run.
              </p>
            </div>
          )}
          <button type='submit' disabled={!date || busy} className={primaryButtonClass}>
            Close date
          </button>
        </fetcher.Form>

        <div className='h-fit overflow-hidden rounded-xl border border-border bg-card'>
          <div className='border-b border-border px-5 py-3'>
            <h2 className='text-lg font-medium'>Upcoming closed dates</h2>
          </div>
          {closedDates.length === 0 && (
            <p className='p-10 text-center text-sm text-muted-foreground'>
              Every tour is open on every date.
            </p>
          )}
          <ul>
            {closedDates.map(({ date: day, tourIds }) => {
              const stillBooked = activeOn(day, tourIds).bookings;
              return (
                <li
                  key={day}
                  className='flex items-center gap-4 border-b border-border/70 px-5 py-3.5 last:border-0'
                >
                  <div className='w-36 shrink-0'>
                    <p className='font-medium'>{formatShortDate(day)}</p>
                    <p className='text-xs text-muted-foreground'>{day.slice(0, 4)}</p>
                  </div>
                  <div className='min-w-0 flex-1 text-sm'>
                    <p>
                      {tourIds.length === tours.length
                        ? 'All tours'
                        : tourIds.map((id) => tourNames.get(id)).join(', ')}
                    </p>
                    {stillBooked > 0 && (
                      <Link
                        to={`/admin/bookings?date=${day}`}
                        className='mt-0.5 block text-xs font-medium text-accent hover:underline'
                      >
                        {stillBooked} Booking{stillBooked > 1 && 's'} still active →
                      </Link>
                    )}
                  </div>
                  <fetcher.Form method='post'>
                    <input type='hidden' name='intent' value='reopen' />
                    <input type='hidden' name='date' value={day} />
                    {tourIds.map((id) => (
                      <input key={id} type='hidden' name='tourIds' value={id} />
                    ))}
                    <button type='submit' disabled={busy} className={outlineButtonClass}>
                      Reopen
                    </button>
                  </fetcher.Form>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <ActionToast result={fetcher.data} />
    </>
  );
}
