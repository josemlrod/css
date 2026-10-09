import { ChevronRight, Search, X } from 'lucide-react';
import { useRef } from 'react';
import {
  Form,
  Link,
  Outlet,
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
import { listBookingsForOperator } from '~/lib/bookings';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import {
  OPERATOR_BOOKING_VIEWS,
  filterOperatorBookings,
  parseBookingView,
  summarizeNextWeek,
} from '~/lib/operator';
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
  const [bookings, tours] = await Promise.all([listBookingsForOperator(), getTours()]);
  const rows = filterOperatorBookings(bookings, filters, today);

  return {
    filters,
    tours: tours.map(({ _id, name }) => ({ _id, name })),
    rows: rows.slice(0, PAGE_SIZE),
    rowCount: rows.length,
    nextWeek: summarizeNextWeek(bookings, today),
    refundFailedCount: bookings.filter((b) => b.paymentStatus === 'refund_failed').length,
  };
}

export default function AdminBookings({ loaderData }: Route.ComponentProps) {
  const { filters, tours, rows, rowCount, nextWeek, refundFailedCount } = loaderData;
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
