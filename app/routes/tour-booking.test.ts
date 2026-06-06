import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  saveCheckoutAttempt,
  updateCheckoutAttempt,
} from '~/lib/checkout-attempts';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import { createCheckoutSession } from '~/lib/stripe';
import { getTourById } from '~/lib/tours';

import { action } from './tour-booking';

vi.mock('~/lib/checkout-attempts', () => ({
  saveCheckoutAttempt: vi.fn(),
  updateCheckoutAttempt: vi.fn(),
}));

vi.mock('~/lib/tours', () => ({
  getTourById: vi.fn(),
}));

vi.mock('~/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
}));

const saveCheckoutAttemptMock = vi.mocked(saveCheckoutAttempt);
const updateCheckoutAttemptMock = vi.mocked(updateCheckoutAttempt);
const createCheckoutSessionMock = vi.mocked(createCheckoutSession);
const getTourByIdMock = vi.mocked(getTourById);

const tour = {
  _id: 'southern-flavors-food',
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

  return new Request('https://example.com/tours/southern-flavors-food', {
    method: 'POST',
    body,
  });
}

describe('tour booking action', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('rejects invalid input without sending booking communication', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);

    const response = await action({
      request: bookingRequest({ email: 'not-an-email' }),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Invalid booking details' },
      init: { status: 400 },
    });
    expect(saveCheckoutAttemptMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('persists checkout attempt and redirects to Stripe Checkout for valid input', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    createCheckoutSessionMock.mockResolvedValueOnce({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    } as never);

    await expect(
      action({
        request: bookingRequest(),
        params: { tourId: 'southern-flavors-food' },
        context: {},
        url: new URL('https://example.com/tours/southern-flavors-food'),
        pattern: '/tours/:tourId',
      }),
    ).rejects.toMatchObject({
      status: 302,
      headers: expect.objectContaining({
        get: expect.any(Function),
      }),
    });

    expect(saveCheckoutAttemptMock).toHaveBeenCalledOnce();
    expect(saveCheckoutAttemptMock).toHaveBeenCalledWith({
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      bookerName: 'Ada Lovelace',
      bookerEmail: 'ada@example.com',
      tourId: 'southern-flavors-food',
      unitPrice: 79,
      total: 158,
      currency: 'usd',
    });
    expect(createCheckoutSessionMock).toHaveBeenCalledWith({
      checkoutAttemptId: 'checkout-attempt-123',
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
      origin: 'https://example.com',
      tour,
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      bookerEmail: 'ada@example.com',
    });
    expect(updateCheckoutAttemptMock).toHaveBeenCalledWith({
      id: 'checkout-attempt-123',
      stripeCheckoutSessionId: 'cs_test_123',
    });
  });

  it('returns an error when Stripe Checkout creation fails', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    const error = new Error('boom');
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    createCheckoutSessionMock.mockRejectedValueOnce(error);

    const response = await action({
      request: bookingRequest(),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to start checkout' },
      init: { status: 500 },
    });
    expect(createCheckoutSessionMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith(error);
  });
});
