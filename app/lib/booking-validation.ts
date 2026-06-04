import * as z from 'zod';

import { isDateOnOrAfterToday } from '~/lib/dates';

export const BookingValidation = z.object({
  date: z.string().min(1).refine(isDateOnOrAfterToday),
  time: z.string().min(1),
  guests: z.number().int().min(1),
  bookerName: z.string().trim().min(1),
  bookerEmail: z.string().trim().email(),
});

export type BookingValidation = z.infer<typeof BookingValidation>;
