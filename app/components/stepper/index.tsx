import { motion, AnimatePresence } from 'motion/react';

import { DateSelector } from './date-selector';
import { useRouteLoaderData } from 'react-router';
import { useStepper } from './stepper-context';
import { GuestSelector } from './guest-selector';
import { BookerDetails } from './booker-details';
import { BookingConfirmation } from './booking-confirmation';

const steps = ['Date', 'Party', 'Details', 'Confirm'] as const;

export function Stepper() {
  const { tour } = useRouteLoaderData('routes/tour-booking');

  const { setStepper, validate, ...stepper } = useStepper();
  const { step, guests } = stepper;

  const total = tour.price * (guests ?? 1);

  return (
    <div className='lg:sticky lg:top-24 lg:self-start'>
      <div className='rounded-xl border border-stone-200 bg-white'>
        {/* Step rail */}
        <div className='border-b border-stone-200 px-5 py-4'>
          <div className='flex items-center gap-2'>
            {steps.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <div key={s} className='flex flex-1 items-center gap-2'>
                  <div className='relative h-1 flex-1 overflow-hidden rounded-full bg-stone-200'>
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
        <div className='flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3'>
          <div>
            <p className='text-[10px] uppercase tracking-wider text-stone-500'>
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
                className='rounded-md px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200'
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                const valid = validate();

                if (valid) {
                  setStepper((prev) => ({
                    ...prev,
                    step: Math.min(steps.length - 1, prev.step + 1),
                  }));
                  return;
                }
              }}
              disabled={step === steps.length - 1}
              className='group inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground'
            >
              {step === steps.length - 1 ? 'Booking confirmed' : 'Continue'}
            </button>
          </div>
        </div>
      </div>

      <p className='mt-3 text-center text-[11px] text-stone-500'>
        Free cancellation up to 24h before
      </p>
    </div>
  );
}
