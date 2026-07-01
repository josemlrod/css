import { Field, FieldDescription, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { useStepper } from './stepper-context';

export function BookerDetails() {
  const {
    booker: { name, email },
    setStepper,
    errors,
  } = useStepper();

  const nameError = errors.name;
  const emailError = errors.email;

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
    </div>
  );
}
