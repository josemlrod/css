import { useRouteLoaderData } from 'react-router';

import { Field, FieldDescription, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { useStepper } from './stepper-context';
import { Button } from '../ui/button';
import { getTodayInBookingTimeZone } from '~/lib/dates';

export function DateSelector() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const { date, time, setStepper, errors } = useStepper();

  const todaysDate = getTodayInBookingTimeZone();

  const dateError = errors.date;
  const timeError = errors.time;

  return (
    <div>
      <div className='flex justify-between'>
        <div>
          <p className='text-base font-medium'>When would you like to go?</p>
        </div>
      </div>

      <div className='mt-4'>
        <Field data-invalid={dateError}>
          <Input
            aria-invalid={dateError}
            className='w-full'
            id='date-selector'
            type='date'
            min={todaysDate}
            defaultValue={date ?? ''}
            onChange={(e) => {
              setStepper((prev) => {
                return {
                  ...prev,
                  date: e.target.value,
                  errors: { ...prev.errors, date: false },
                };
              });
            }}
          />
          {dateError ? (
            <FieldDescription className='text-destructive/80'>
              Choose today or a future date
            </FieldDescription>
          ) : null}
        </Field>
      </div>
      <Field className='mt-5'>
        <FieldLabel className='text-base font-medium text-foreground'>
          Time slot
        </FieldLabel>
        <div className='mt-2 flex flex-wrap gap-1.5'>
          {tour.startTimes.map((t: string) => (
            <Button
              aria-invalid={timeError}
              variant='secondary'
              key={t}
              onClick={() =>
                setStepper((prev) => ({
                  ...prev,
                  time: t,
                  errors: { ...prev.errors, time: false },
                }))
              }
              className={`rounded-full aria-invalid:ring-1 aria-invalid:ring-destructive/10 ${t === time ? 'bg-primary text-primary-foreground hover:bg-primary/70' : ''}`}
            >
              {t}
            </Button>
          ))}
        </div>

        {timeError ? (
          <FieldDescription className='text-destructive/80'>
            Please select a time{' '}
          </FieldDescription>
        ) : null}
      </Field>
    </div>
  );
}
