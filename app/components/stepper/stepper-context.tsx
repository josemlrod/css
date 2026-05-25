import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from 'react';
import * as z from 'zod';

const Booker = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
});
type Booker = z.infer<typeof Booker>;

const BookingDetails = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  guests: z.number().int().min(1),
});
type BookingDetails = z.infer<typeof BookingDetails>;

export type Stepper = {
  step: number;
  errors: Record<string, boolean>;
  booker: Booker;
} & BookingDetails;

type SetStepper = React.Dispatch<React.SetStateAction<Stepper>>;

type StepperContextType =
  | (Stepper & { setStepper: SetStepper; validate: () => boolean })
  | null;

const StepperContext = createContext<StepperContextType>(null);

export function useStepper() {
  const context = useContext(StepperContext);

  if (!context) {
    throw new Error('useStepper should be used within StepperProvider');
  }

  return context;
}

export function StepperProvider({ children }: PropsWithChildren) {
  const [stepper, setStepper] = useState<Stepper>({
    step: 0,
    date: '',
    time: '',
    guests: 0,
    booker: {
      name: '',
      email: '',
    },
    errors: {},
  });

  const stepValidation = {
    0: () => {
      const BookingDateTime = BookingDetails.pick({ date: true, time: true });
      const res = BookingDateTime.safeParse({
        date: stepper.date,
        time: stepper.time,
      });

      if (res.success) return true;
      else {
        const messages = JSON.parse(res.error.message);
        const errors: Record<string, boolean> = {};
        for (const m of messages) {
          const { path } = m;
          const [fieldName] = path;
          errors[fieldName] = true;
        }
        setStepper((prev) => ({
          ...prev,
          errors,
        }));
        return false;
      }
    },
    1: () => {
      const BookingGuests = BookingDetails.pick({ guests: true });
      const res = BookingGuests.safeParse({
        guests: stepper.guests,
      });

      if (res.success) return true;
      else {
        const messages = JSON.parse(res.error.message);
        const errors: Record<string, boolean> = {};
        for (const m of messages) {
          const { path } = m;
          const [fieldName] = path;
          errors[fieldName] = true;
        }
        setStepper((prev) => ({
          ...prev,
          errors,
        }));
        return false;
      }
    },
    2: () => {
      const res = Booker.safeParse({
        name: stepper.booker.name,
        email: stepper.booker.email,
      });

      if (res.success) return true;
      else {
        const messages = JSON.parse(res.error.message);
        const errors: Record<string, boolean> = {};
        for (const m of messages) {
          const { path } = m;
          const [fieldName] = path;
          errors[fieldName] = true;
        }
        setStepper((prev) => ({
          ...prev,
          errors,
        }));
        return false;
      }
    },
  };
  const validate = stepValidation[stepper.step as keyof typeof stepValidation];

  return (
    <StepperContext value={{ ...stepper, setStepper, validate }}>
      {children}
    </StepperContext>
  );
}
