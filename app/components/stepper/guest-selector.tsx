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
      <p className='text-base font-medium'>How many guests?</p>
      <p className='mt-1 text-sm text-muted-foreground'>
        Up to {tour.maxGuests} per booking
      </p>
      <Field data-invalid={guestError} className='mt-4'>
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-5'>
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
                className={`min-h-11 ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50 aria-invalid:border-destructive/45 aria-invalid:ring-1 aria-invalid:ring-destructive/10'
                }`}
              >
                {n}
              </Button>
            );
          })}
        </div>
        {guestError ? (
          <FieldDescription className='text-destructive/80'>
            Please select the number of guests
          </FieldDescription>
        ) : null}
      </Field>
      <div className='mt-5 rounded-md bg-muted p-3 text-sm text-muted-foreground'>
        Small group of{' '}
        <strong className='font-medium text-foreground'>{tour.maxGuests}</strong>{' '}
        max keeps the experience intimate — perfect for asking questions and
        chatting with the chefs.
      </div>
    </div>
  );
}
