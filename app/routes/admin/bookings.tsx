import { CalendarPlus, CalendarX, ChevronRight, Search, X } from 'lucide-react';
import { useRef } from 'react';
import {
  Form,
  Link,
  Outlet,
  data,
  useFetcher,
  useLocation,
  useNavigate,
  useParams,
  useSubmit,
} from 'react-router';

import {
  PageHeader,
  StatusPill,
  fieldClass,
} from '~/components/admin/primitives';
import { listBookingActivity, listBookingsForOperator } from '~/lib/bookings';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import {
  ACTIVITY_WINDOW_MS,
  OPERATOR_BOOKING_VIEWS,
  filterOperatorBookings,
  parseBookingView,
  summarizeActivity,
  summarizeNextWeek,
} from '~/lib/operator';
import {
  readActivitySeenAt,
  serializeActivitySeenAt,
} from '~/lib/operator-session.server';
import { getTours } from '~/lib/tours';
import { cn } from '~/lib/utils';

import type { Route } from './+types/bookings';

const PAGE_SIZE = 100;

export function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const filters = {
    view: parseBookingView(url.searchParams.get('view')),
    query: url.searchParams.get('q') ?? '',
    tourId: url.searchParams.get('tour') ?? '',
    date: url.searchParams.get('date') ?? '',
  };
  const today = getTodayInBookingTimeZone();
  const now = Date.now();
  const [bookings, tours, activity, seenAt] = await Promise.all([
    listBookingsForOperator(),
    getTours(),
    listBookingActivity(now - ACTIVITY_WINDOW_MS),
    readActivitySeenAt(request),
  ]);
  const rows = filterOperatorBookings(bookings, filters, today);

  return {
    activity: summarizeActivity(activity, seenAt, now),
    filters,
    tours: tours.map(({ _id, name }) => ({ _id, name })),
    rows: rows.slice(0, PAGE_SIZE),
    rowCount: rows.length,
    nextWeek: summarizeNextWeek(bookings, today),
    refundFailedCount: bookings.filter((b) => b.paymentStatus === 'refund_failed').length,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if ((await request.formData()).get('intent') !== 'mark-seen') {
    return data({ ok: false }, { status: 400 });
  }

  return data(
    { ok: true },
    { headers: { 'Set-Cookie': await serializeActivitySeenAt(Date.now()) } },
  );
}

export default function AdminBookings({ loaderData }: Route.ComponentProps) {
  const { activity, filters, tours, rows, rowCount, nextWeek, refundFailedCount } =
    loaderData;
  const { search } = useLocation();
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const submit = useSubmit();
  const searchTimeout = useRef<number>(undefined);
  const tourNames = new Map(tours.map((tour) => [tour._id, tour.name]));

  function viewHref(view: string) {
    const params = new URLSearchParams(search);
    params.set('view', view);
    return `/admin/bookings?${params}`;
  }

  const clearDateParams = new URLSearchParams(search);
  clearDateParams.delete('date');

  const stats = [
    { label: 'Bookings next 7 days', value: nextWeek.bookings },
    { label: 'Guests next 7 days', value: nextWeek.guests },
    { label: 'Revenue next 7 days', value: `$${nextWeek.revenue.toLocaleString()}` },
    { label: 'Refunds to fix', value: refundFailedCount, alert: refundFailedCount > 0 },
  ];

  return (
    <>
      <PageHeader title='Bookings' />

      <div className='mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {stats.map((stat) => (
          <div key={stat.label} className='rounded-xl border border-border bg-card p-4'>
            <p className='text-xs text-muted-foreground'>{stat.label}</p>
            <p
              className={cn(
                'mt-1 text-2xl font-semibold tabular-nums',
                stat.alert ? 'text-destructive' : 'text-primary',
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <RecentActivity activity={activity} search={search} />

      <div className='overflow-hidden rounded-xl border border-border bg-card'>
        <div className='flex flex-wrap items-center gap-3 border-b border-border p-3'>
          {filters.date ? (
            <span className='inline-flex h-9 items-center gap-2 rounded-full bg-secondary/35 pr-1.5 pl-3 text-sm font-medium text-primary'>
              {formatShortDate(filters.date)}
              <Link
                aria-label='Clear date filter'
                to={`/admin/bookings?${clearDateParams}`}
                className='flex size-6 items-center justify-center rounded-full hover:bg-card'
              >
                <X className='size-3.5' />
              </Link>
            </span>
          ) : (
            <nav className='flex rounded-lg bg-muted p-1' aria-label='Booking views'>
              {OPERATOR_BOOKING_VIEWS.map((view) => (
                <Link
                  key={view.id}
                  to={viewHref(view.id)}
                  aria-current={filters.view === view.id ? 'page' : undefined}
                  className={cn(
                    'flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors',
                    filters.view === view.id
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {view.label}
                </Link>
              ))}
            </nav>
          )}

          <Form
            method='get'
            className='ml-auto flex flex-wrap gap-3'
            onChange={(e) => {
              const form = e.currentTarget;
              window.clearTimeout(searchTimeout.current);
              // Typing waits for a pause; the tour select submits right away.
              const delay = (e.target as HTMLElement).getAttribute('name') === 'q' ? 300 : 0;
              searchTimeout.current = window.setTimeout(
                () => submit(form, { replace: true }),
                delay,
              );
            }}
          >
            <input type='hidden' name='view' value={filters.view} />
            {filters.date && <input type='hidden' name='date' value={filters.date} />}
            <div className='relative w-64'>
              <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
              <input
                type='search'
                name='q'
                defaultValue={filters.query}
                placeholder='Name, email, or Booking ID'
                aria-label='Search Bookings'
                className={cn(fieldClass, 'pl-9')}
              />
            </div>
            <select
              name='tour'
              defaultValue={filters.tourId}
              aria-label='Tour'
              className={cn(fieldClass, 'w-56')}
            >
              <option value=''>All tours</option>
              {tours.map((tour) => (
                <option key={tour._id} value={tour._id}>
                  {tour.name}
                </option>
              ))}
            </select>
          </Form>
        </div>

        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-xs text-muted-foreground'>
              <th className='px-4 py-2.5 font-medium'>Booker</th>
              <th className='px-4 py-2.5 font-medium'>Tour</th>
              <th className='px-4 py-2.5 font-medium'>When</th>
              <th className='px-4 py-2.5 text-right font-medium'>Guests</th>
              <th className='px-4 py-2.5 text-right font-medium'>Total</th>
              <th className='px-4 py-2.5 font-medium'>Status</th>
              <th className='w-8' />
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => (
              <tr
                key={booking._id}
                onClick={() => navigate(`/admin/bookings/${booking._id}${search}`)}
                className={cn(
                  'cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-muted/60',
                  bookingId === booking._id && 'bg-secondary/15',
                )}
              >
                <td className='px-4 py-3'>
                  <Link
                    to={`/admin/bookings/${booking._id}${search}`}
                    className='font-medium hover:underline'
                    onClick={(e) => e.stopPropagation()}
                  >
                    {booking.bookerName}
                  </Link>
                  <p className='text-xs text-muted-foreground'>{booking.bookerEmail}</p>
                </td>
                <td className='max-w-56 truncate px-4 py-3'>
                  {tourNames.get(booking.tourId) ?? 'Unknown tour'}
                </td>
                <td className='whitespace-nowrap px-4 py-3 tabular-nums'>
                  {formatShortDate(booking.date)} · {booking.time}
                </td>
                <td className='px-4 py-3 text-right tabular-nums'>{booking.guests}</td>
                <td className='px-4 py-3 text-right tabular-nums'>${booking.total}</td>
                <td className='px-4 py-3'>
                  <StatusPill booking={booking} />
                </td>
                <td className='pr-3 text-muted-foreground'>
                  <ChevronRight className='size-4' />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rowCount === 0 && (
          <p className='p-10 text-center text-sm text-muted-foreground'>No Bookings match.</p>
        )}
        {rowCount > rows.length && (
          <p className='border-t border-border p-3 text-center text-xs text-muted-foreground'>
            Showing {rows.length} of {rowCount}. Narrow by tour or search.
          </p>
        )}
      </div>

      <Outlet />
    </>
  );
}

function RecentActivity({
  activity,
  search,
}: {
  activity: Route.ComponentProps['loaderData']['activity'];
  search: string;
}) {
  const fetcher = useFetcher<typeof action>();
  const newCount = fetcher.state === 'idle' ? activity.newCount : 0;

  return (
    <section
      aria-labelledby='recent-activity'
      className='mb-6 overflow-hidden rounded-xl border border-border bg-card'
    >
      <div className='flex h-12 items-center gap-2 border-b border-border px-4'>
        <h2 id='recent-activity' className='text-sm font-medium'>
          Recent activity
        </h2>
        {newCount > 0 && (
          <span className='rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground'>
            {newCount} new
          </span>
        )}
        {newCount > 0 && (
          <fetcher.Form method='post' action='/admin/bookings' className='ml-auto'>
            <button
              name='intent'
              value='mark-seen'
              className='h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            >
              Mark all as seen
            </button>
          </fetcher.Form>
        )}
      </div>
      {activity.items.length === 0 ? (
        <p className='p-6 text-center text-sm text-muted-foreground'>
          No Bookings or cancellations in the last 7 days.
        </p>
      ) : (
        <ul>
          {activity.items.map((item) => {
            const isNew = item.isNew && newCount > 0;
            const Icon = item.type === 'booked' ? CalendarPlus : CalendarX;

            return (
              <li
                key={`${item.type}-${item.bookingId}`}
                className='border-b border-border/70 last:border-0'
              >
                <Link
                  to={`/admin/bookings/${item.bookingId}${search}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/60',
                    isNew && 'bg-secondary/15',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      item.type === 'booked'
                        ? 'bg-secondary/40 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className='size-3.5' />
                  </span>
                  <p className='min-w-0 flex-1 truncate'>
                    <span className='font-medium'>{item.bookerName}</span>{' '}
                    {item.type === 'booked' ? 'booked' : 'canceled'} {item.tourName}
                    <span className='text-muted-foreground'>
                      {' '}
                      · {formatShortDate(item.date)} · {item.time} · {item.guests}{' '}
                      {item.guests === 1 ? 'guest' : 'guests'}
                    </span>
                  </p>
                  {isNew && (
                    <span className='rounded-full border border-primary/30 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary'>
                      New
                    </span>
                  )}
                  <span className='w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground'>
                    {item.age}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
