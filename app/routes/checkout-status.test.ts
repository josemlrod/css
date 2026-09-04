import { describe, expect, it, vi } from 'vitest';

import {
  getCheckoutAttemptWithTour,
  hashCheckoutAccessToken,
} from '~/lib/checkout-attempts';

import { loader as cancelLoader } from './checkout-cancel';
import { loader as successLoader } from './checkout-success';

vi.mock('~/lib/checkout-attempts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/checkout-attempts')>();

  return {
    ...actual,
    getCheckoutAttemptWithTour: vi.fn(),
  };
});

const getCheckoutAttemptWithTourMock = vi.mocked(getCheckoutAttemptWithTour);

const checkoutAttempt = {
  _id: 'checkout-attempt-123',
  _creationTime: 0,
  tourId: 'tour-123',
  date: '2026-01-02',
  time: '11:30 AM',
  guests: 2,
  bookerName: 'Ada Lovelace',
  bookerEmail: 'ada@example.com',
  unitPrice: 79,
  total: 158,
  currency: 'usd',
  paypalOrderId: 'ORDER123',
  paymentStatus: 'pending',
  expiresAt: Date.now() + 30 * 60 * 1000,
  accessTokenHash: hashCheckoutAccessToken('raw-token'),
  updatedAt: 0,
};

const tour = {
  _id: 'tour-123',
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

function loaderArgs(url: string) {
  return {
    request: new Request(url),
    params: { checkoutAttemptId: 'checkout-attempt-123' },
    context: {},
  } as never;
}

describe('checkout status loaders', () => {
  it('rejects invalid access tokens', async () => {
    getCheckoutAttemptWithTourMock.mockResolvedValueOnce({
      checkoutAttempt,
      tour,
    } as never);

    await expect(
      successLoader(loaderArgs('https://example.com/checkout/success/checkout-attempt-123?token=wrong')),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it('loads pending Checkout Attempt on success route without creating Booking', async () => {
    getCheckoutAttemptWithTourMock.mockResolvedValueOnce({
      checkoutAttempt,
      tour,
    } as never);

    await expect(
      successLoader(loaderArgs('https://example.com/checkout/success/checkout-attempt-123?token=raw-token')),
    ).resolves.toMatchObject({
      checkoutAttempt: { paymentStatus: 'pending' },
      tour: { name: 'Southern Flavors Food Tour' },
    });
  });

  it('loads expired Checkout Attempt on success route', async () => {
    getCheckoutAttemptWithTourMock.mockResolvedValueOnce({
      checkoutAttempt: {
        ...checkoutAttempt,
        paymentStatus: 'expired',
        expiresAt: Date.now() - 1,
      },
      tour,
    } as never);

    await expect(
      successLoader(loaderArgs('https://example.com/checkout/success/checkout-attempt-123?token=raw-token')),
    ).resolves.toMatchObject({
      checkoutAttempt: { paymentStatus: 'expired' },
    });
  });

  it('loads webhook-completed Checkout Attempt on success route', async () => {
    getCheckoutAttemptWithTourMock.mockResolvedValueOnce({
      checkoutAttempt: { ...checkoutAttempt, paymentStatus: 'paid' },
      tour,
    } as never);

    await expect(
      successLoader(loaderArgs('https://example.com/checkout/success/checkout-attempt-123?token=raw-token')),
    ).resolves.toMatchObject({
      checkoutAttempt: { paymentStatus: 'paid' },
    });
  });

  it('loads canceled return route without creating Booking', async () => {
    getCheckoutAttemptWithTourMock.mockResolvedValueOnce({
      checkoutAttempt,
      tour,
    } as never);

    await expect(
      cancelLoader(loaderArgs('https://example.com/checkout/cancel/checkout-attempt-123?token=raw-token')),
    ).resolves.toMatchObject({
      checkoutAttempt: { _id: 'checkout-attempt-123' },
      tour: { _id: 'tour-123' },
    });
  });
});
