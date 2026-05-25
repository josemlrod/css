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
    booker: { name },
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
        <p className='mt-1 text-xs text-stone-500'>Review the details below</p>
      </div>
      <dl className='space-y-2 rounded-md border border-stone-200 p-4 text-sm'>
        <div className='flex justify-between'>
          <dt className='text-stone-500'>Tour</dt>
          <dd className='font-medium'>{tour.name}</dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-stone-500'>Date</dt>
          <dd className='font-medium'>
            {date
              ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}{' '}
            · {time}
          </dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-stone-500'>Guests</dt>
          <dd className='font-medium'>{guests}</dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-stone-500'>Guest</dt>
          <dd className='font-medium'>{name || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
