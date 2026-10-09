import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '~/lib/utils';
import type { Booking } from '~/lib/types';

export const fieldClass =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

export const labelClass = 'text-xs font-medium text-muted-foreground';

export const primaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-[background-color,opacity,transform] hover:bg-primary/85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';

export const outlineButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition-[background-color,transform] hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageHeader({ title }: { title: string }) {
  return <h1 className='mb-6 text-3xl font-medium tracking-tight'>{title}</h1>;
}

type BookingState = Pick<Booking, 'cancelled' | 'paymentStatus'>;

export function getBookingDisplayStatus({ cancelled, paymentStatus }: BookingState) {
  if (paymentStatus === 'refund_failed') return 'refund_failed';
  if (!cancelled) return 'confirmed';
  if (paymentStatus === 'refund_pending') return 'refund_pending';
  return 'refunded';
}

const statusLabels = {
  confirmed: 'Confirmed',
  refund_pending: 'Refund pending',
  refunded: 'Canceled · refunded',
  refund_failed: 'Refund failed',
} as const;

export function StatusPill({ booking }: { booking: BookingState }) {
  const status = getBookingDisplayStatus(booking);

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'confirmed' && 'bg-primary text-primary-foreground',
        status === 'refund_pending' && 'bg-secondary/40 text-primary',
        status === 'refunded' && 'bg-muted text-muted-foreground',
        status === 'refund_failed' && 'bg-destructive/10 text-destructive',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'confirmed' && 'bg-accent',
          status === 'refund_pending' && 'bg-primary',
          status === 'refunded' && 'bg-muted-foreground/50',
          status === 'refund_failed' && 'bg-destructive',
        )}
      />
      {statusLabels[status]}
    </span>
  );
}

// Shows the latest action result. Pass the action's data object; a new object re-shows the toast.
export function ActionToast({
  result,
}: {
  result?: { ok: boolean; message?: string; error?: string };
}) {
  const [visible, setVisible] = useState(result);

  useEffect(() => {
    setVisible(result);
    if (!result) return;
    const timeout = window.setTimeout(() => setVisible(undefined), 3200);
    return () => window.clearTimeout(timeout);
  }, [result]);

  const text = visible?.ok ? visible.message : visible?.error;

  if (!visible || !text) return null;

  return (
    <div
      role='status'
      className={cn(
        'fixed right-5 bottom-5 z-[60] flex max-w-sm items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out',
        visible.ok ? 'border-border' : 'border-destructive/30 text-destructive',
      )}
    >
      {visible.ok && (
        <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15'>
          <Check className='size-3 text-accent' />
        </span>
      )}
      {text}
    </div>
  );
}
