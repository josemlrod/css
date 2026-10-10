import {
  CalendarOff,
  ExternalLink,
  LogOut,
  Map as MapIcon,
  Monitor,
  Ticket,
} from 'lucide-react';
import { Form, NavLink, Outlet } from 'react-router';

import { Eyebrow } from '~/components/admin/primitives';
import { countRefundFailedBookings } from '~/lib/bookings';
import { operatorContext, requireOperator } from '~/lib/operator-session.server';
import { cn } from '~/lib/utils';

import type { Route } from './+types/layout';

export const middleware: Route.MiddlewareFunction[] = [requireOperator];

export function meta() {
  return [
    { title: 'Operator · Cinematic Sites of Savannah' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  return {
    operator: context.get(operatorContext),
    refundFailedCount: await countRefundFailedBookings(),
  };
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
    {
      to: '/admin/closed-dates',
      label: 'Closed dates',
      icon: CalendarOff,
      badge: 0,
    },
  ];

  return (
    <>
      <SmallScreenNotice />
      {/* The console is laid out for desktop widths; smaller screens get the notice instead. */}
      <div className='hidden min-h-screen bg-muted/50 lg:flex'>
        <aside className='sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card'>
          <div className='h-2 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-repeat-x' />
          <div className='px-5 pt-5 pb-6'>
            <img
              src='/logo.png'
              alt='Cinematic Sites of Savannah'
              className='h-16 w-auto'
            />
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
            <div className='flex items-center gap-2 pt-1'>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium text-foreground'>
                  {loaderData.operator.name ?? loaderData.operator.email}
                </p>
                {loaderData.operator.name && (
                  <p className='truncate'>{loaderData.operator.email}</p>
                )}
              </div>
              <Form method='post' action='/admin/logout'>
                <button
                  type='submit'
                  aria-label='Sign out'
                  title='Sign out'
                  className='flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground'
                >
                  <LogOut className='size-4' />
                </button>
              </Form>
            </div>
          </div>
        </aside>

        <main className='min-w-0 flex-1 px-8 py-8 pb-16'>
          <div className='mx-auto max-w-6xl'>
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}

function SmallScreenNotice() {
  return (
    <main className='flex min-h-screen flex-col bg-muted/50 lg:hidden'>
      <div className='h-2 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-repeat-x' />
      <div className='mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center'>
        <img
          src='/logo.png'
          alt='Cinematic Sites of Savannah'
          className='h-20 w-auto'
        />
        <Eyebrow className='mt-4'>Operator</Eyebrow>
        <div className='mt-8 flex size-14 items-center justify-center rounded-full bg-secondary/40'>
          <Monitor className='size-6 text-primary' />
        </div>
        <h1 className='mt-4 text-balance text-2xl font-medium tracking-tight'>
          Open this on a larger screen
        </h1>
        <p className='mt-2 text-base text-muted-foreground'>
          The operator console isn&apos;t built for phones or small tablets yet.
          Use a laptop or desktop, or widen this window to at least 1024 pixels.
        </p>
        <a
          href='https://cinematicsitesofsavannah.com/savannah-movie-tours/'
          className='mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'
        >
          View tours site <ExternalLink className='size-3' />
        </a>
      </div>
    </main>
  );
}
