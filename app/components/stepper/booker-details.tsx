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
        <FieldLabel className='text-xs font-medium text-stone-700'>
          Full name
        </FieldLabel>
        <Input
          aria-invalid={nameError}
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
          <FieldDescription className='text-destructive'>
            Please enter your full name
          </FieldDescription>
        ) : null}
      </Field>
      <Field data-invalid={emailError}>
        <FieldLabel className='text-xs font-medium text-stone-700'>
          Email
        </FieldLabel>
        <Input
          aria-invalid={emailError}
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
          <FieldDescription className='text-destructive'>
            Please enter a valid email address
          </FieldDescription>
        ) : null}
      </Field>
    </div>
  );
}
