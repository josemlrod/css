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

    window.onPayPalWebSdkLoaded = () => {
      if (settled) return;
      if (!window.paypal) {
        fail(new Error('PayPal SDK did not initialize'));
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(window.paypal);
    };

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
  const sessions = useRef<{
    paypal?: PaymentSession;
    card?: PaymentSession;
  }>({});
  const checkoutAttempt = useRef<{
    id: string;
    accessToken: string;
  } | null>(null);
  const pendingOrder = useRef<{
    resolve: (order: { orderId: string }) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [eligible, setEligible] = useState({ paypal: false, card: false });
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function createOrder() {
    setError(null);
    setNotice(null);

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
      <Button
        type='button'
        onClick={() => void startPayment('paypal')}
        disabled={loading || creatingOrder || !eligible.paypal}
        className='min-h-11 w-full rounded-full bg-[#ffc439] px-5 py-2 text-base font-semibold text-[#111] transition-colors hover:bg-[#f2ba36] disabled:cursor-not-allowed disabled:opacity-50'
      >
        {creatingOrder ? 'Starting checkout...' : 'PayPal'}
      </Button>
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
