import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

type Props = {
  tourStartTimes: string[];
  tourPrice: number;
  tourMaxGuests: number;
  tourName: string;
};

const dates = Array.from({ length: 14 }).map((_, i) => {
  const d = new Date(2026, 4, 18 + i);
  return {
    iso: d.toISOString().slice(0, 10),
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: d.getDate(),
  };
});

const steps = ['Date', 'Party', 'Details', 'Confirm'] as const;

export function Stepper({
  tourStartTimes,
  tourPrice,
  tourMaxGuests,
  tourName,
}: Props) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(dates[3].iso);
  const [time, setTime] = useState(tourStartTimes[0]);
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const total = tourPrice * guests;

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
            {step === 0 && (
              <div>
                <p className='text-sm font-medium'>
                  When would you like to go?
                </p>
                <p className='mt-1 text-xs text-stone-500'>
                  Showing the next 14 days
                </p>
                <div className='mt-4 grid grid-cols-7 gap-1.5'>
                  {dates.map((d) => {
                    const active = d.iso === date;
                    return (
                      <button
                        key={d.iso}
                        onClick={() => setDate(d.iso)}
                        className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-xs transition-all ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        <span className='text-[10px] opacity-70'>{d.day}</span>
                        <span className='text-base font-medium'>{d.num}</span>
                      </button>
                    );
                  })}
                </div>
                <div className='mt-5'>
                  <p className='text-xs font-medium text-stone-700'>
                    Time slot
                  </p>
                  <div className='mt-2 flex flex-wrap gap-1.5'>
                    {tourStartTimes.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTime(t)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                          t === time
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <p className='text-sm font-medium'>How many guests?</p>
                <p className='mt-1 text-xs text-stone-500'>
                  Up to {tourMaxGuests} per booking
                </p>
                <div className='mt-4 grid grid-cols-5 gap-1.5'>
                  {Array.from({ length: tourMaxGuests }).map((_, i) => {
                    const n = i + 1;
                    const active = n === guests;
                    return (
                      <button
                        key={n}
                        onClick={() => setGuests(n)}
                        className={`rounded-md border py-3 text-lg font-medium transition-all ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className='mt-5 rounded-md bg-stone-50 p-3 text-xs text-stone-600'>
                  Small group of{' '}
                  <strong className='font-medium text-stone-900'>
                    {tourMaxGuests}
                  </strong>{' '}
                  max keeps the experience intimate — perfect for asking
                  questions and chatting with the chefs.
                </div>
              </div>
            )}

            {step === 2 && (
              <div className='space-y-4'>
                <div>
                  <label className='text-xs font-medium text-stone-700'>
                    Full name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Alex Rivera'
                    className='mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary'
                  />
                </div>
                <div>
                  <label className='text-xs font-medium text-stone-700'>
                    Email
                  </label>
                  <input
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder='alex@example.com'
                    className='mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary'
                  />
                </div>
                <div>
                  <label className='text-xs font-medium text-stone-700'>
                    Dietary needs (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder='Vegetarian, allergies, etc.'
                    className='mt-1.5 w-full resize-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary'
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className='space-y-4'>
                <div className='text-center'>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                    className='mx-auto flex size-12 items-center justify-center rounded-full bg-accent/15'
                  >
                    <Check className='size-5 text-accent' />
                  </motion.div>
                  <p className='mt-3 text-base font-medium'>Ready to confirm</p>
                  <p className='mt-1 text-xs text-stone-500'>
                    Review the details below
                  </p>
                </div>
                <dl className='space-y-2 rounded-md border border-stone-200 p-4 text-sm'>
                  <div className='flex justify-between'>
                    <dt className='text-stone-500'>Tour</dt>
                    <dd className='font-medium'>{tourName}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-stone-500'>Date</dt>
                    <dd className='font-medium'>
                      {new Date(date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {time}
                    </dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-stone-500'>Guests</dt>
                    <dd className='font-medium'>{guests}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-stone-500'>Guest</dt>
                    <dd className='font-medium'>{name || '—'}</dd>
                  </div>
                </dl>
              </div>
            )}
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
                onClick={() => setStep(step - 1)}
                className='rounded-md px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200'
              >
                Back
              </button>
            )}
            <button
              onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
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
