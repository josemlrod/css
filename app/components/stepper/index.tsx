import { motion, AnimatePresence } from 'motion/react';

import { DateSelector } from './date-selector';
import { useNavigation, useRouteLoaderData, useSubmit } from 'react-router';
import { useStepper } from './stepper-context';
import { GuestSelector } from './guest-selector';
import { BookerDetails } from './booker-details';
import { BookingConfirmation } from './booking-confirmation';
import { Button } from '../ui/button';

const steps = ['Date', 'Party', 'Details', 'Confirm'] as const;

export function Stepper() {
  const { tour } = useRouteLoaderData('routes/tour-booking');
  const navigation = useNavigation();
  const submit = useSubmit();

  const { setStepper, validate, ...stepper } = useStepper();
  const { step, date, time, guests, booker } = stepper;

  const total = tour.price * (guests ?? 1);
  const submitting = navigation.state !== 'idle';

  return (
    <div>
      <div className='rounded-xl border border-border bg-white'>
        {/* Step rail */}
        <div className='border-b border-border px-5 py-4'>
          <div className='flex items-center gap-2'>
            {steps.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <div key={s} className='flex flex-1 items-center gap-2'>
                  <div className='relative h-1 flex-1 overflow-hidden rounded-full bg-muted'>
                    <motion.div
                      initial={false}
                      animate={{ width: active || done ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className='absolute inset-y-0 left-0 bg-primary'
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode='wait'>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className='space-y-5 p-5'
          >
            {step === 0 && <DateSelector />}
            {step === 1 && <GuestSelector />}
            {step === 2 && <BookerDetails />}
            {step === 3 && <BookingConfirmation />}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className='flex items-center justify-between border-t border-border bg-muted px-5 py-3'>
          <div>
            <p className='text-sm uppercase tracking-wider text-muted-foreground'>
              Total
            </p>
            <motion.p
              key={total}
              initial={{ opacity: 0.5, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className='text-lg font-medium tabular-nums'
            >
              ${total}
            </motion.p>
          </div>
          <div className='flex items-center gap-2'>
            {step > 0 && (
              <button
                onClick={() =>
                  setStepper((prev) => ({ ...prev, step: prev.step - 1 }))
                }
                className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-border'
              >
                Back
              </button>
            )}
            <Button
              variant='cta'
              size='cta'
              onClick={() => {
                const valid = validate();

                if (!valid) {
                  return;
                }

                if (step === steps.length - 1) {
                  submit(
                    {
                      intent: 'confirm-booking',
                      date,
                      time,
                      guests: String(guests),
                      name: booker.name,
                      email: booker.email,
                    },
                    { method: 'post' },
                  );
                  return;
                }

                setStepper((prev) => ({
                  ...prev,
                  step: Math.min(steps.length - 1, prev.step + 1),
                }));
              }}
              disabled={submitting}
              className='disabled:cursor-not-allowed disabled:opacity-60'
            >
              {submitting
                ? 'Opening checkout...'
                : step === steps.length - 1
                  ? 'Continue to payment'
                  : 'Continue'}
            </Button>
          </div>
        </div>
      </div>

      <p className='mt-3 text-center text-sm text-muted-foreground'>
        Free cancellation up to 24h before
      </p>
    </div>
  );
}
