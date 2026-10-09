import { useRouteLoaderData } from 'react-router';

import { Field, FieldDescription, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { useStepper } from './stepper-context';
import { Button } from '../ui/button';
import {
  DATE_UNAVAILABLE_MESSAGE,
  MAX_BOOKING_WINDOW_DAYS,
  getLastBookableDate,
  getTodayInBookingTimeZone,
  isDateBlocked,
  isTourStartBookable,
} from '~/lib/dates';

export function DateSelector() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const { date, time, setStepper, errors } = useStepper();

  const todaysDate = getTodayInBookingTimeZone();
  const lastBookableDate = getLastBookableDate();

  const dateBlocked = isDateBlocked(tour, date);
  const dateError = errors.date || dateBlocked;
  const dateErrorMessage = dateBlocked
    ? DATE_UNAVAILABLE_MESSAGE
    : date > lastBookableDate
      ? `Choose a date within the next ${MAX_BOOKING_WINDOW_DAYS} days`
      : 'Choose today or a future date';
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
            className='min-h-11 w-full text-base md:text-sm'
            id='date-selector'
            type='date'
            min={todaysDate}
            max={lastBookableDate}
            defaultValue={date ?? ''}
            onChange={(e) => {
              const nextDate = e.target.value;
              setStepper((prev) => {
                return {
                  ...prev,
                  date: nextDate,
                  time:
                    prev.time && isTourStartBookable(nextDate, prev.time)
                      ? prev.time
                      : '',
                  errors: { ...prev.errors, date: false },
                };
              });
            }}
          />
          {dateError ? (
            <FieldDescription className='text-destructive/80'>
              {dateErrorMessage}
            </FieldDescription>
          ) : null}
        </Field>
      </div>
      <Field className='mt-5'>
        <FieldLabel className='text-base font-medium text-foreground'>
          Time slot
        </FieldLabel>
        <div className='mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
          {tour.startTimes.map((t: string) => (
            <Button
              aria-invalid={timeError}
              variant='secondary'
              key={t}
              disabled={Boolean(date) && !isTourStartBookable(date, t)}
              onClick={() =>
                setStepper((prev) => ({
                  ...prev,
                  time: t,
                  errors: { ...prev.errors, time: false },
                }))
              }
              className={`min-h-11 rounded-full aria-invalid:ring-1 aria-invalid:ring-destructive/10 ${t === time ? 'bg-primary text-primary-foreground hover:bg-primary/70' : ''}`}
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
