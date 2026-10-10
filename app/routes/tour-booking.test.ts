import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterContextProvider } from 'react-router';

import {
  saveCheckoutAttempt,
  updateCheckoutAttempt,
} from '~/lib/checkout-attempts';
import {
  DATE_UNAVAILABLE_MESSAGE,
  getTodayInBookingTimeZone,
} from '~/lib/dates';
import {
  type Operator,
  optionalOperatorContext,
} from '~/lib/operator-session.server';
import { createPayPalOrder } from '~/lib/paypal';
import { getTourBySlug } from '~/lib/tours';

import { action, loader } from './tour-booking';

vi.mock('~/lib/checkout-attempts', () => ({
  saveCheckoutAttempt: vi.fn(),
  updateCheckoutAttempt: vi.fn(),
}));

vi.mock('~/lib/tours', () => ({
  getTourBySlug: vi.fn(),
}));

vi.mock('~/lib/paypal', () => ({
  createPayPalOrder: vi.fn(),
}));

const saveCheckoutAttemptMock = vi.mocked(saveCheckoutAttempt);
const updateCheckoutAttemptMock = vi.mocked(updateCheckoutAttempt);
const createPayPalOrderMock = vi.mocked(createPayPalOrder);
const getTourBySlugMock = vi.mocked(getTourBySlug);

const tour = {
  _id: 'tour_123',
  _creationTime: 0,
  slug: 'southern-flavors-food',
  name: 'Southern Flavors Food Tour',
  tagline: 'Six tastings, three centuries of Lowcountry cooking',
  description: 'Eat your way through the Historic District.',
  longDescription: 'Eat your way through the Historic District.',
  duration: '3 hours',
  durationMinutes: 180,
  price: 79,
  maxGuests: 10,
  imageUrl: '/tours/food-tour.jpg',
  category: 'Food',
  highlights: ['Six tastings included'],
  startTimes: ['11:30 AM'],
  meetingPoint: "Broughton & Bull Street, in front of Leopold's",
  updatedAt: 0,
};

function bookingRequest(overrides: Record<string, string> = {}) {
  const body = new URLSearchParams({
    intent: 'confirm-booking',
    date: getTodayInBookingTimeZone(),
    time: '11:30 AM',
    guests: '2',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    ...overrides,
  });

  return new Request('https://example.com/tour/southern-flavors-food', {
    method: 'POST',
    body,
  });
}

describe('tour booking action', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T14:00:00Z')); // 10:00 AM Eastern
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 404 for an unknown tour slug', async () => {
    getTourBySlugMock.mockResolvedValueOnce(null);

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'unknown-tour' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/unknown-tour'),
      pattern: '/tour/:slug',
    });

    expect(getTourBySlugMock).toHaveBeenCalledWith('unknown-tour');
    expect(response).toMatchObject({
      data: { ok: false, error: 'Tour not found' },
      init: { status: 404 },
    });
    expect(saveCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects invalid input without sending booking communication', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourBySlugMock.mockResolvedValueOnce(tour as never);

    const response = await action({
      request: bookingRequest({ email: 'not-an-email' }),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Invalid booking details' },
      init: { status: 400 },
    });
    expect(saveCheckoutAttemptMock).not.toHaveBeenCalled();
    expect(createPayPalOrderMock).not.toHaveBeenCalled();
  });

  it('rejects a date the operator blocked', async () => {
    getTourBySlugMock.mockResolvedValueOnce({
      ...tour,
      blockedDates: [getTodayInBookingTimeZone()],
    } as never);

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: DATE_UNAVAILABLE_MESSAGE },
      init: { status: 400 },
    });
    expect(saveCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('rejects a start time that has already passed today', async () => {
    vi.setSystemTime(new Date('2026-09-25T15:30:00Z')); // 11:30 AM Eastern
    getTourBySlugMock.mockResolvedValueOnce(tour as never);

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Invalid booking details' },
      init: { status: 400 },
    });
    expect(saveCheckoutAttemptMock).not.toHaveBeenCalled();
  });

  it('persists a checkout attempt and returns the PayPal order', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourBySlugMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    createPayPalOrderMock.mockResolvedValueOnce({ id: 'ORDER123' });

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: {
        ok: true,
        orderId: 'ORDER123',
        checkoutAttemptId: 'checkout-attempt-123',
        accessToken: 'raw-token',
      },
    });
    expect(saveCheckoutAttemptMock).toHaveBeenCalledOnce();
    expect(saveCheckoutAttemptMock).toHaveBeenCalledWith({
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      bookerName: 'Ada Lovelace',
      bookerEmail: 'ada@example.com',
      tourId: 'tour_123',
      unitPrice: 79,
      total: 158,
      currency: 'usd',
    });
    expect(createPayPalOrderMock).toHaveBeenCalledWith({
      checkoutAttemptId: 'checkout-attempt-123',
      accessToken: 'raw-token',
      origin: 'https://example.com',
      tour,
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      total: 158,
      bookerEmail: 'ada@example.com',
    });
    expect(updateCheckoutAttemptMock).toHaveBeenCalledWith({
      id: 'checkout-attempt-123',
      paypalOrderId: 'ORDER123',
    });
  });

  it('returns an error when PayPal order creation fails', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourBySlugMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    const error = new Error('boom');
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    createPayPalOrderMock.mockRejectedValueOnce(error);

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to start checkout' },
      init: { status: 500 },
    });
    expect(createPayPalOrderMock).toHaveBeenCalledOnce();
    expect(JSON.parse(consoleErrorMock.mock.calls[0][0])).toMatchObject({
      event: 'checkout.start_failed',
      checkoutAttemptId: 'checkout-attempt-123',
      error: { message: 'boom' },
    });
  });

  it('returns an error when PayPal omits the order ID', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourBySlugMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    createPayPalOrderMock.mockResolvedValueOnce({ id: '' });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await action({
      request: bookingRequest(),
      params: { slug: 'southern-flavors-food' },
      context: new RouterContextProvider(),
      url: new URL('https://example.com/tour/southern-flavors-food'),
      pattern: '/tour/:slug',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to start checkout' },
      init: { status: 500 },
    });
    expect(updateCheckoutAttemptMock).not.toHaveBeenCalled();
  });
});

describe('tour booking loader', () => {
  it('returns 404 for an unknown or malformed tour slug', async () => {
    getTourBySlugMock.mockResolvedValueOnce(null);

    await expect(
      loader({
        request: new Request('https://example.com/tour/not-a-tour%20id'),
        params: { slug: 'not-a-tour id' },
        context: new RouterContextProvider(),
        url: new URL('https://example.com/tour/not-a-tour%20id'),
        pattern: '/tour/:slug',
      }),
    ).rejects.toMatchObject({
      data: 'Tour not found',
      init: { status: 404 },
    });
    expect(getTourBySlugMock).toHaveBeenCalledWith('not-a-tour id');
  });

  it('shows the test tour only to signed-in Operators', async () => {
    const testTour = { ...tour, slug: 'test-tour', test: true };
    const loadTestTour = (operator: Operator | null) => {
      const context = new RouterContextProvider();
      context.set(optionalOperatorContext, operator);
      getTourBySlugMock.mockResolvedValueOnce(testTour as never);

      return loader({
        request: new Request('https://example.com/tour/test-tour'),
        params: { slug: 'test-tour' },
        context,
        url: new URL('https://example.com/tour/test-tour'),
        pattern: '/tour/:slug',
      });
    };

    await expect(loadTestTour(null)).rejects.toMatchObject({ init: { status: 404 } });
    await expect(loadTestTour({ name: 'Op' } as Operator)).resolves.toEqual({
      tour: testTour,
    });
  });
});
