import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveBooking } from '~/lib/bookings';
import { getTodayInBookingTimeZone } from '~/lib/dates';
import { sendBookingCommunication } from '~/lib/email';
import { getTourById } from '~/lib/tours';

import { action } from './tour-booking';

vi.mock('~/lib/email', () => ({
  sendBookingCommunication: vi.fn(),
}));

vi.mock('~/lib/bookings', () => ({
  saveBooking: vi.fn(),
}));

vi.mock('~/lib/tours', () => ({
  getTourById: vi.fn(),
}));

const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);
const saveBookingMock = vi.mocked(saveBooking);
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
    expect(sendBookingCommunicationMock).not.toHaveBeenCalled();
    expect(saveBookingMock).not.toHaveBeenCalled();
  });

  it('persists booking and sends booking communication for valid input', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);
    saveBookingMock.mockResolvedValueOnce('booking-123' as never);

    const response = await action({
      request: bookingRequest(),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
    });

    expect(response).toEqual({ ok: true });
    expect(saveBookingMock).toHaveBeenCalledOnce();
    expect(saveBookingMock).toHaveBeenCalledWith({
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      bookerName: 'Ada Lovelace',
      bookerEmail: 'ada@example.com',
      tourId: 'southern-flavors-food',
      cancelled: null,
    });
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith({
      to: 'ada@example.com',
      bookerName: 'Ada Lovelace',
      tourName: 'Southern Flavors Food Tour',
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      total: 158,
      meetingPoint: "Broughton & Bull Street, in front of Leopold's",
      editUrl: 'https://example.com/manage/booking-123',
      cancelUrl: 'https://example.com/manage/booking-123',
    });
  });

  it('returns an error when booking communication fails', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    getTourByIdMock.mockResolvedValueOnce(tour as never);
    saveBookingMock.mockResolvedValueOnce('booking-123' as never);
    const error = new Error('boom');
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    sendBookingCommunicationMock.mockRejectedValueOnce(error);

    const response = await action({
      request: bookingRequest(),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
    });

    expect(response).toMatchObject({
      data: { ok: false, error: 'Unable to send booking communication' },
      init: { status: 500 },
    });
    expect(sendBookingCommunicationMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith(error);
  });
});
