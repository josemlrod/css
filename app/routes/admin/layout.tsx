import { CalendarOff, ExternalLink, Map as MapIcon, Ticket } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { Eyebrow } from '~/components/admin/primitives';
import { countRefundFailedBookings } from '~/lib/bookings';
import { cn } from '~/lib/utils';

import type { Route } from './+types/layout';

// TODO: put /admin behind operator sign-in before launch. It is open for now.
export function meta() {
  return [
    { title: 'Operator · Cinematic Sites of Savannah' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

export async function loader() {
  return { refundFailedCount: await countRefundFailedBookings() };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const nav = [
    {
      to: '/admin/bookings',
      label: 'Bookings',
      icon: Ticket,
      badge: loaderData.refundFailedCount,
    },
    { to: '/admin/tours', label: 'Tours', icon: MapIcon, badge: 0 },
    { to: '/admin/closed-dates', label: 'Closed dates', icon: CalendarOff, badge: 0 },
  ];

  return (
    <div className='flex min-h-screen bg-muted/50'>
      <aside className='sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card'>
        <div className='h-2 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-repeat-x' />
        <div className='px-5 pt-5 pb-6'>
          <img src='/logo.png' alt='Cinematic Sites of Savannah' className='h-16 w-auto' />
          <Eyebrow className='mt-3'>Operator</Eyebrow>
        </div>
        <nav className='grid gap-0.5 px-3' aria-label='Operator'>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary/35 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className='size-4' />
              {item.label}
              {item.badge > 0 && (
                <span className='ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold tabular-nums text-white'>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className='mt-auto grid gap-2 border-t border-border p-5 text-xs text-muted-foreground'>
          <a
            href='https://cinematicsitesofsavannah.com/savannah-movie-tours/'
            className='inline-flex items-center gap-1.5 font-medium text-primary hover:underline'
          >
            View tours site <ExternalLink className='size-3' />
          </a>
          <p>No sign-in yet. Don&apos;t share this link.</p>
        </div>
      </aside>

      <main className='min-w-0 flex-1 px-8 py-8 pb-16'>
        <div className='mx-auto max-w-6xl'>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
