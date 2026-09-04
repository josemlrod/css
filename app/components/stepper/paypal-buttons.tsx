import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '~/components/ui/button';

import { useStepper } from './stepper-context';

type PaymentSession = {
  start: (
    options: { presentationMode: 'auto' },
    orderPromise: Promise<{ orderId: string }>,
  ) => Promise<void>;
};

type PaymentSessionCallbacks = {
  onApprove: (data: { orderId: string }) => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
  onWarn?: (warning: { message?: string }) => void;
};

type PayPalSdkInstance = {
  findEligibleMethods: (options: { currencyCode: 'USD' }) => Promise<{
    isEligible: (method: 'paypal' | 'card') => boolean;
  }>;
  createPayPalOneTimePaymentSession: (
    callbacks: PaymentSessionCallbacks,
  ) => PaymentSession;
  createPayPalGuestOneTimePaymentSession: (
    callbacks: PaymentSessionCallbacks,
  ) => PaymentSession;
};

type PayPalSdk = {
  createInstance: (options: {
    clientId: string;
    components: ['paypal-payments', 'paypal-guest-payments'];
    pageType: 'checkout';
  }) => Promise<PayPalSdkInstance>;
};

type ConfirmBookingResponse =
  | {
      ok: true;
      orderId: string;
      checkoutAttemptId: string;
      accessToken: string;
    }
  | { ok: false; error: string };

declare global {
  interface Window {
    paypal?: PayPalSdk;
    onPayPalWebSdkLoaded?: () => void;
  }
}

let paypalSdkPromise: Promise<PayPalSdk> | undefined;

function loadPayPalSdk(src: string) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;

  paypalSdkPromise = new Promise((resolve, reject) => {
    window.onPayPalWebSdkLoaded = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error('PayPal SDK did not initialize'));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-paypal-web-sdk-v6]',
    );

    if (existingScript) {
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Unable to load PayPal checkout')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.paypalWebSdkV6 = 'true';
    script.addEventListener(
      'error',
      () => {
        paypalSdkPromise = undefined;
        reject(new Error('Unable to load PayPal checkout'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return paypalSdkPromise;
}

export function PayPalButtons() {
  const navigate = useNavigate();
  const { date, time, guests, booker, validate } = useStepper();
  const sessions = useRef<{
    paypal?: PaymentSession;
    card?: PaymentSession;
  }>({});
  const checkoutAttempt = useRef<{
    id: string;
    accessToken: string;
  } | null>(null);
  const [eligible, setEligible] = useState({ paypal: false, card: false });
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const environment =
      import.meta.env.VITE_PAYPAL_ENV ??
      (import.meta.env.DEV ? 'sandbox' : 'live');
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

    async function initialize() {
      try {
        if (!clientId) throw new Error('PayPal checkout is not configured');
        if (environment !== 'sandbox' && environment !== 'live') {
          throw new Error('VITE_PAYPAL_ENV must be sandbox or live');
        }

        const src =
          environment === 'live'
            ? 'https://www.paypal.com/web-sdk/v6/core'
            : 'https://www.sandbox.paypal.com/web-sdk/v6/core';
        const paypal = await loadPayPalSdk(src);
        const sdkInstance = await paypal.createInstance({
          clientId,
          components: ['paypal-payments', 'paypal-guest-payments'],
          pageType: 'checkout',
        });
        const paymentMethods = await sdkInstance.findEligibleMethods({
          currencyCode: 'USD',
        });
        const paypalEligible = paymentMethods.isEligible('paypal');
        const cardEligible = paymentMethods.isEligible('card');
        const onApprove = ({ orderId }: { orderId: string }) => {
          // Issue #47 will capture the approved order and navigate to success.
          setNotice(
            `Payment approved for order ${orderId}. Booking completion is not available yet.`,
          );
        };
        const onCancel = () => {
          const attempt = checkoutAttempt.current;

          if (!attempt) {
            setError('Unable to open the canceled checkout. Please try again.');
            return;
          }

          navigate(
            `/checkout/cancel/${encodeURIComponent(attempt.id)}?token=${encodeURIComponent(attempt.accessToken)}`,
          );
        };
        const onError = () => {
          setError('PayPal could not complete checkout. Please try again.');
        };

        if (!active) return;

        sessions.current = {
          paypal: paypalEligible
            ? sdkInstance.createPayPalOneTimePaymentSession({
                onApprove,
                onCancel,
                onError,
              })
            : undefined,
          card: cardEligible
            ? sdkInstance.createPayPalGuestOneTimePaymentSession({
                onApprove,
                onCancel,
                onError,
                onWarn: (warning) =>
                  setError(
                    warning.message ??
                      'Please check your card details and try again.',
                  ),
              })
            : undefined,
        };
        setEligible({ paypal: paypalEligible, card: cardEligible });

        if (!paypalEligible && !cardEligible) {
          setError('PayPal payment methods are not available.');
        }
      } catch (sdkError) {
        if (!active) return;
        console.error(sdkError);
        setError(
          sdkError instanceof Error
            ? sdkError.message
            : 'Unable to load PayPal checkout',
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
      sessions.current = {};
    };
  }, [navigate]);

  async function createOrder() {
    setError(null);
    setNotice(null);

    if (!validate()) {
      const validationError = 'Check your booking details before paying.';
      setError(validationError);
      throw new Error(validationError);
    }

    setCreatingOrder(true);

    try {
      const response = await fetch(window.location.pathname, {
        method: 'POST',
        body: new URLSearchParams({
          intent: 'confirm-booking',
          date,
          time,
          guests: String(guests),
          name: booker.name,
          email: booker.email,
        }),
      });
      const result = (await response.json()) as ConfirmBookingResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          result.ok ? 'Unable to start checkout' : result.error,
        );
      }

      checkoutAttempt.current = {
        id: result.checkoutAttemptId,
        accessToken: result.accessToken,
      };

      return { orderId: result.orderId };
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? orderError.message
          : 'Unable to start checkout',
      );
      throw orderError;
    } finally {
      setCreatingOrder(false);
    }
  }

  async function startPayment(method: 'paypal' | 'card') {
    const session = sessions.current[method];

    if (!session || creatingOrder) return;

    try {
      await session.start({ presentationMode: 'auto' }, createOrder());
    } catch {
      setError((current) => current ?? 'Unable to start checkout');
    }
  }

  return (
    <div className='grid w-full gap-2 sm:w-64'>
      <button
        type='button'
        onClick={() => void startPayment('paypal')}
        disabled={loading || creatingOrder || !eligible.paypal}
        className='min-h-11 w-full rounded-full bg-[#ffc439] px-5 py-2 text-base font-semibold text-[#111] transition-colors hover:bg-[#f2ba36] disabled:cursor-not-allowed disabled:opacity-50'
      >
        {creatingOrder ? 'Starting checkout...' : 'PayPal'}
      </button>
      <Button
        type='button'
        variant='cta'
        size='cta'
        onClick={() => void startPayment('card')}
        disabled={loading || creatingOrder || !eligible.card}
        className='min-h-11 w-full whitespace-normal text-center disabled:cursor-not-allowed sm:whitespace-nowrap'
      >
        Debit or Credit Card
      </Button>
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
      {notice && <p className='text-sm text-muted-foreground'>{notice}</p>}
    </div>
  );
}
