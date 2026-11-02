import { useEffect, useRef, useState } from 'react';

import { cn } from '~/lib/utils';

import { Field, FieldDescription, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { useStepper } from './stepper-context';

export function BookerDetails() {
  const {
    booker: { name, email },
    guests,
    guestNames,
    setStepper,
    errors,
  } = useStepper();

  const nameError = errors.name;
  const emailError = errors.email;
  const guestFieldsRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    const container = guestFieldsRef.current;
    if (!container) return;

    const updateScrollAffordance = () => {
      setHasMoreBelow(
        container.scrollTop + container.clientHeight < container.scrollHeight - 1,
      );
    };
    updateScrollAffordance();
    const observer = new ResizeObserver(updateScrollAffordance);
    observer.observe(container);
    return () => observer.disconnect();
  }, [guests]);

  return (
    <div className='space-y-4'>
      <Field data-invalid={nameError}>
        <FieldLabel className='text-base font-medium text-foreground'>
          Full name
        </FieldLabel>
        <Input
          aria-invalid={nameError}
          className='min-h-11 text-base md:text-sm'
          value={name ?? ''}
          onChange={(e) =>
            setStepper((prev) => ({
              ...prev,
              booker: { ...prev.booker, name: e.target.value },
              errors: { ...prev.errors, name: false },
            }))
          }
          placeholder='Alex Rivera'
        />
        {nameError ? (
          <FieldDescription className='text-destructive/80'>
            Please enter your full name
          </FieldDescription>
        ) : null}
      </Field>
      <Field data-invalid={emailError}>
        <FieldLabel className='text-base font-medium text-foreground'>
          Email
        </FieldLabel>
        <Input
          aria-invalid={emailError}
          className='min-h-11 text-base md:text-sm'
          type='email'
          value={email ?? ''}
          onChange={(e) =>
            setStepper((prev) => ({
              ...prev,
              booker: { ...prev.booker, email: e.target.value },
              errors: { ...prev.errors, email: false },
            }))
          }
          placeholder='alex@example.com'
        />
        {emailError ? (
          <FieldDescription className='text-destructive/80'>
            Please enter a valid email address
          </FieldDescription>
        ) : null}
      </Field>
      {guests > 1 && (
        <div className='space-y-4'>
          <FieldDescription>
            Optional. Add the names of the people joining you.
          </FieldDescription>
          {/* Three fields: snug label + gap-2 + min-h-11, plus two space-y-4 gaps. */}
          <div
            ref={guestFieldsRef}
            onScroll={(event) => {
              const container = event.currentTarget;
              setHasMoreBelow(
                container.scrollTop + container.clientHeight < container.scrollHeight - 1,
              );
            }}
            className={cn(
              '-mx-1 max-h-[calc(3*(1.375rem+0.5rem+2.75rem)+2*1rem)] space-y-4 overflow-y-auto overscroll-contain px-1',
              hasMoreBelow && '[mask-image:linear-gradient(to_bottom,black_calc(100%_-_1rem),transparent)]',
            )}
          >
            {Array.from({ length: guests - 1 }, (_, index) => (
              <Field key={index} data-invalid={errors.guestNames}>
                <FieldLabel
                  htmlFor={`guest-name-${index}`}
                  className='text-base font-medium text-foreground'
                >
                  Guest {index + 2} name
                </FieldLabel>
                <Input
                  id={`guest-name-${index}`}
                  autoComplete='off'
                  maxLength={100}
                  aria-invalid={errors.guestNames}
                  className='min-h-11 text-base md:text-sm'
                  value={guestNames[index] ?? ''}
                  onChange={(e) =>
                    setStepper((prev) => {
                      const names = Array.from(
                        { length: prev.guests - 1 },
                        (_, i) => prev.guestNames[i] ?? '',
                      );
                      names[index] = e.target.value;
                      return {
                        ...prev,
                        guestNames: names,
                        errors: { ...prev.errors, guestNames: false },
                      };
                    })
                  }
                />
              </Field>
            ))}
          </div>
          {errors.guestNames && (
            <FieldDescription className='text-destructive/80'>
              Each guest name must be 100 characters or fewer
            </FieldDescription>
          )}
        </div>
      )}
    </div>
  );
}
