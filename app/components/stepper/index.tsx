import { motion, AnimatePresence } from 'motion/react';

import { DateSelector } from './date-selector';
import { useRouteLoaderData } from 'react-router';
import { useStepper } from './stepper-context';
import { GuestSelector } from './guest-selector';
import { BookerDetails } from './booker-details';
import { BookingConfirmation } from './booking-confirmation';
import { PayPalButtons } from './paypal-buttons';
import { Button } from '../ui/button';

const steps = ['Date', 'Party', 'Details', 'Confirm'] as const;

export function Stepper() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const { setStepper, validate, ...stepper } = useStepper();
  const { step, guests } = stepper;

  const total = tour.price * (guests ?? 1);

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
        <div className='flex flex-col gap-3 border-t border-border bg-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
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
          <div className='flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
            {step > 0 && (
              <button
                onClick={() =>
                  setStepper((prev) => ({ ...prev, step: prev.step - 1 }))
                }
                className='min-h-11 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-border sm:w-auto'
              >
                Back
              </button>
            )}
            {step === steps.length - 1 ? (
              <PayPalButtons />
            ) : (
              <Button
                variant='default'
                onClick={() => {
                  if (!validate()) return;

                  setStepper((prev) => ({
                    ...prev,
                    step: Math.min(steps.length - 1, prev.step + 1),
                  }));
                }}
                className='min-h-11 w-full whitespace-normal text-center sm:w-auto sm:whitespace-nowrap'
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className='mt-3 text-center text-xs leading-snug text-muted-foreground'>
        Pay securely with PayPal or debit/credit card
      </p>
      <p className='text-center text-xs leading-snug text-muted-foreground'>
        Free cancellation up to 24h before.
      </p>
    </div>
  );
}
