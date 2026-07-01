import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouteLoaderData } from 'react-router';
import { useStepper } from './stepper-context';

export function BookingConfirmation() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const {
    date,
    time,
    guests,
    booker: { name, email },
  } = useStepper();

  return (
    <div className='space-y-4'>
      <div className='text-center'>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className='mx-auto flex size-12 items-center justify-center rounded-full bg-accent/15'
        >
          <Check className='size-5 text-accent' />
        </motion.div>
        <p className='mt-3 text-base font-medium'>Ready to confirm</p>
        <p className='mt-1 text-sm text-muted-foreground'>Review the details below</p>
      </div>
      <dl className='space-y-2 rounded-md border border-border p-4 text-sm'>
        <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
          <dt className='text-muted-foreground'>Tour</dt>
          <dd className='min-w-0 break-words font-medium sm:text-right'>{tour.name}</dd>
        </div>
        <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
          <dt className='text-muted-foreground'>Date</dt>
          <dd className='min-w-0 break-words font-medium sm:text-right'>
            {date
              ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}{' '}
            · {time}
          </dd>
        </div>
        <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
          <dt className='text-muted-foreground'>Guests</dt>
          <dd className='min-w-0 break-words font-medium sm:text-right'>{guests}</dd>
        </div>
        <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
          <dt className='text-muted-foreground'>Guest</dt>
          <dd className='min-w-0 break-words font-medium sm:text-right'>{name || '—'}</dd>
        </div>
        <div className='grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-4'>
          <dt className='text-muted-foreground'>Email</dt>
          <dd className='min-w-0 break-words font-medium sm:text-right'>{email || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
