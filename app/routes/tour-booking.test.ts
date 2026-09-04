import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  saveCheckoutAttempt,
  updateCheckoutAttempt,
} from '~/lib/checkout-attempts';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import { createPayPalOrder } from '~/lib/paypal';
import { getTourById } from '~/lib/tours';

import { action } from './tour-booking';

vi.mock('~/lib/checkout-attempts', () => ({
  saveCheckoutAttempt: vi.fn(),
  updateCheckoutAttempt: vi.fn(),
}));

vi.mock('~/lib/tours', () => ({
  getTourById: vi.fn(),
}));

vi.mock('~/lib/paypal', () => ({
  createPayPalOrder: vi.fn(),
}));

const saveCheckoutAttemptMock = vi.mocked(saveCheckoutAttempt);
const updateCheckoutAttemptMock = vi.mocked(updateCheckoutAttempt);
const createPayPalOrderMock = vi.mocked(createPayPalOrder);
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
    expect(createPayPalOrderMock).not.toHaveBeenCalled();
  });

  it('persists a checkout attempt and returns the PayPal order', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);
    saveCheckoutAttemptMock.mockResolvedValueOnce({
      checkoutAttemptId: 'checkout-attempt-123' as never,
      accessToken: 'raw-token',
      expiresAt: 1767227400000,
    });
    createPayPalOrderMock.mockResolvedValueOnce({ id: 'ORDER123' });

    const response = await action({
      request: bookingRequest(),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
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
      tourId: 'southern-flavors-food',
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
    createPayPalOrderMock.mockRejectedValueOnce(error);

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
    expect(createPayPalOrderMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith(error);
  });
});
