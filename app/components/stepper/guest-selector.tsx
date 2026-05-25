import { useRouteLoaderData } from 'react-router';

import { Field, FieldDescription } from '../ui/field';
import { useStepper } from './stepper-context';
import { Button } from '../ui/button';

export function GuestSelector() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const { guests, setStepper, errors } = useStepper();

  const guestError = errors.guests;

  return (
    <div>
      <p className='text-sm font-medium'>How many guests?</p>
      <p className='mt-1 text-xs text-stone-500'>
        Up to {tour.maxGuests} per booking
      </p>
      <Field data-invalid={guestError} className='mt-4'>
        <div className='grid grid-cols-5 gap-1.5'>
          {Array.from({ length: tour.maxGuests }).map((_, i) => {
            const n = i + 1;
            const active = n === guests;
            return (
              <Button
                aria-invalid={guestError}
                variant='ghost'
                size='lg'
                key={n}
                onClick={() =>
                  setStepper((prev) => ({
                    ...prev,
                    guests: n,
                    errors: { ...prev.errors, guests: false },
                  }))
                }
                className={`${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                {n}
              </Button>
            );
          })}
        </div>
        {guestError ? (
          <FieldDescription className='text-destructive'>
            Please select the number of guests
          </FieldDescription>
        ) : null}
      </Field>
      <div className='mt-5 rounded-md bg-stone-50 p-3 text-xs text-stone-600'>
        Small group of{' '}
        <strong className='font-medium text-stone-900'>{tour.maxGuests}</strong>{' '}
        max keeps the experience intimate — perfect for asking questions and
        chatting with the chefs.
      </div>
    </div>
  );
}
