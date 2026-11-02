import * as z from 'zod';

import {
  isDateOnOrAfterToday,
  isDateWithinBookingWindow,
} from '~/lib/dates';

function isCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) return false;

  return parsedDate.toISOString().slice(0, 10) === date;
}

export const BookingDetailsValidation = z.object({
  date: z
    .string()
    .min(1)
    .refine(isCalendarDate)
    .refine(isDateOnOrAfterToday)
    .refine(isDateWithinBookingWindow),
  time: z.string().min(1),
  guests: z.number().int().min(1),
});

export const BookerValidation = z.object({
  bookerName: z.string().trim().min(1),
  bookerEmail: z.string().trim().email(),
  guestNames: z
    .array(z.string())
    .transform((names) => names.map((name) => name.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(100)))
    .default([]),
});

export const BookingValidation = BookingDetailsValidation.extend(
  BookerValidation.shape,
).refine(({ guests, guestNames }) => guestNames.length <= guests - 1, {
  message: 'Too many guest names for this party size',
  path: ['guestNames'],
});

export type BookingDetailsValidation = z.infer<typeof BookingDetailsValidation>;
export type BookerValidation = z.infer<typeof BookerValidation>;
export type BookingValidation = z.infer<typeof BookingValidation>;
