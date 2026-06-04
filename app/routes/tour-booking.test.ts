import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTodayInBookingTimeZone } from '~/lib/dates';
import { sendBookingCommunication } from '~/lib/email';

import { action } from './tour-booking';

vi.mock('~/lib/email', () => ({
  sendBookingCommunication: vi.fn(),
}));

const sendBookingCommunicationMock = vi.mocked(sendBookingCommunication);

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
  });

  it('sends booking communication for valid input', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');

    const response = await action({
      request: bookingRequest(),
      params: { tourId: 'southern-flavors-food' },
      context: {},
      url: new URL('https://example.com/tours/southern-flavors-food'),
      pattern: '/tours/:tourId',
    });

    expect(response).toEqual({ ok: true });
    expect(sendBookingCommunicationMock).toHaveBeenCalledWith({
      to: 'ada@example.com',
      bookerName: 'Ada Lovelace',
      tourName: 'Southern Flavors Food Tour',
      date: getTodayInBookingTimeZone(),
      time: '11:30 AM',
      guests: 2,
      total: 158,
      meetingPoint: "Broughton & Bull Street, in front of Leopold's",
      editUrl: 'https://example.com/bookings/placeholder/edit',
      cancelUrl: 'https://example.com/bookings/placeholder/cancel',
    });
  });

  it('returns an error when booking communication fails', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://example.com');
    sendBookingCommunicationMock.mockRejectedValueOnce(new Error('boom'));

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
  });
});
