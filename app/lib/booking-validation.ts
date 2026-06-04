import * as z from 'zod';

import { isDateOnOrAfterToday } from '~/lib/dates';

function isCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) return false;

  return parsedDate.toISOString().slice(0, 10) === date;
}

export const BookingValidation = z.object({
  date: z.string().min(1).refine(isCalendarDate).refine(isDateOnOrAfterToday),
  time: z.string().min(1),
  guests: z.number().int().min(1),
  bookerName: z.string().trim().min(1),
  bookerEmail: z.string().trim().email(),
});

export type BookingValidation = z.infer<typeof BookingValidation>;
