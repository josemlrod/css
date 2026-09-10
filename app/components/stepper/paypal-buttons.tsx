import { useEffect, useRef, useState } from 'react';
import { useFetcher, useNavigate } from 'react-router';

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
    isEligible: (method: 'paypal') => boolean;
  }>;
  createPayPalOneTimePaymentSession: (
    callbacks: PaymentSessionCallbacks,
  ) => PaymentSession;
};

type PayPalSdk = {
  createInstance: (options: {
    clientId: string;
    components: ['paypal-payments'];
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

type CaptureResponse =
  | { ok: true; status: string; checkoutAttemptId: string }
  | { ok: false; status?: string; error?: string };

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

let paypalSdkPromise: Promise<PayPalSdk> | undefined;

function loadPayPalSdk(src: string) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-paypal-web-sdk-v6]',
  );
  const script = existingScript ?? document.createElement('script');

  paypalSdkPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      paypalSdkPromise = undefined;
      if (!window.paypal) script.remove();
      reject(error);
    };
    timeoutId = window.setTimeout(
      () => fail(new Error('Unable to load PayPal checkout')),
      15_000,
    );

    const succeed = () => {
      if (settled) return;
      if (!window.paypal) {
        fail(new Error('PayPal SDK did not initialize'));
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(window.paypal);
    };
    script.addEventListener('load', succeed, { once: true });

    if (existingScript) {
      existingScript.addEventListener(
        'error',
        () => fail(new Error('Unable to load PayPal checkout')),
        { once: true },
      );
      return;
    }

    script.src = src;
    script.async = true;
    script.dataset.paypalWebSdkV6 = 'true';
    script.addEventListener(
      'error',
      () => fail(new Error('Unable to load PayPal checkout')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return paypalSdkPromise;
}

export function PayPalButtons() {
  const navigate = useNavigate();
  const fetcher = useFetcher<ConfirmBookingResponse>();
  const { date, time, guests, booker, validate } = useStepper();
  const session = useRef<PaymentSession | null>(null);
  const checkoutAttempt = useRef<{
    id: string;
    accessToken: string;
  } | null>(null);
  const pendingOrder = useRef<{
    resolve: (order: { orderId: string }) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pending = pendingOrder.current;

    if (fetcher.state !== 'idle' || !fetcher.data || !pending) return;

    pendingOrder.current = null;
    setCreatingOrder(false);

    if (!fetcher.data.ok) {
      const orderError = new Error(fetcher.data.error);
      setError(orderError.message);
      pending.reject(orderError);
      return;
    }

    checkoutAttempt.current = {
      id: fetcher.data.checkoutAttemptId,
      accessToken: fetcher.data.accessToken,
    };
    pending.resolve({ orderId: fetcher.data.orderId });
  }, [fetcher.data, fetcher.state]);

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
          components: ['paypal-payments'],
          pageType: 'checkout',
        });
        const paymentMethods = await sdkInstance.findEligibleMethods({
          currencyCode: 'USD',
        });
        const paypalEligible = paymentMethods.isEligible('paypal');
        const onApprove = async ({ orderId }: { orderId: string }) => {
          const attempt = checkoutAttempt.current;

          if (!attempt) {
            setError('Unable to complete payment. Please try again.');
            return;
          }

          setCapturing(true);
          setError(null);

          try {
            const response = await fetch(
              `/paypal/capture/${encodeURIComponent(attempt.id)}?token=${encodeURIComponent(attempt.accessToken)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
              },
            );
            const result = (await response.json()) as CaptureResponse;

            if (!result.ok) {
              throw new Error(
                result.error ??
                  'PayPal could not complete payment. Please try again.',
              );
            }

            navigate(
              `/checkout/success/${encodeURIComponent(attempt.id)}?token=${encodeURIComponent(attempt.accessToken)}`,
            );
          } catch (captureError) {
            if (!active) return;
            setError(
              captureError instanceof Error
                ? captureError.message
                : 'PayPal could not complete payment. Please try again.',
            );
          } finally {
            if (active) setCapturing(false);
          }
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

        session.current = paypalEligible
          ? sdkInstance.createPayPalOneTimePaymentSession({
              onApprove,
              onCancel,
              onError,
            })
          : null;
        setEligible(paypalEligible);

        if (!paypalEligible) {
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
      session.current = null;
    };
  }, [navigate]);

  function createOrder() {
    setError(null);

    if (!validate()) {
      const validationError = 'Check your booking details before paying.';
      setError(validationError);
      throw new Error(validationError);
    }

    if (pendingOrder.current) {
      return Promise.reject(new Error('Checkout is already starting'));
    }

    setCreatingOrder(true);

    return new Promise<{ orderId: string }>((resolve, reject) => {
      pendingOrder.current = { resolve, reject };
      void fetcher
        .submit(
          {
            intent: 'confirm-booking',
            date,
            time,
            guests: String(guests),
            name: booker.name,
            email: booker.email,
          },
          { method: 'post' },
        )
        .catch((submissionError: unknown) => {
          if (pendingOrder.current?.reject !== reject) return;

          pendingOrder.current = null;
          setCreatingOrder(false);
          const orderError =
            submissionError instanceof Error
              ? submissionError
              : new Error('Unable to start checkout');
          setError(orderError.message);
          reject(orderError);
        });
    });
  }

  async function startPayment() {
    const paymentSession = session.current;

    if (!paymentSession || creatingOrder || capturing) return;

    try {
      await paymentSession.start({ presentationMode: 'auto' }, createOrder());
    } catch {
      setError((current) => current ?? 'Unable to start checkout');
    }
  }

  return (
    <div className='grid min-w-0 w-full gap-1.5 sm:w-56'>
      <Button
        type='button'
        variant='default'
        onClick={() => void startPayment()}
        disabled={loading || creatingOrder || capturing || !eligible}
        className='min-h-10 w-full whitespace-normal text-center text-sm disabled:cursor-not-allowed md:text-base'
      >
        {creatingOrder
          ? 'Starting checkout...'
          : capturing
            ? 'Completing payment...'
            : 'Continue to payment'}
      </Button>

      {error && (
        <p role='alert' className='text-sm text-destructive break-words'>
          {error}
        </p>
      )}
    </div>
  );
}
