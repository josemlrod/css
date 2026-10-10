import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBookingForOperator, markBookingRefunded } from '~/lib/bookings';
import { refundBooking } from '~/lib/refunds';
import { setTourDateBlocked, updateTourSettings } from '~/lib/tours';

import { action as bookingAction, loader as bookingLoader } from './booking';
import { action as bookingsAction } from './bookings';
import { action as closedDatesAction } from './closed-dates';
import { action as toursAction } from './tours';

vi.mock('~/lib/bookings', () => ({
  getBookingForOperator: vi.fn(),
  listBookingsForOperator: vi.fn(),
  markBookingRefunded: vi.fn(),
}));
vi.mock('~/lib/refunds', () => ({ refundBooking: vi.fn() }));
vi.mock('~/lib/tours', () => ({
  getTours: vi.fn(),
  setTourDateBlocked: vi.fn(),
  updateTourSettings: vi.fn(),
}));

const paid = {
  _id: 'booking_1',
  bookerName: 'Ana Delgado',
  bookerEmail: 'ana@example.com',
  date: '2099-10-10',
  time: '9:00 PM',
  guests: 3,
  cancelled: null as number | null,
  paymentStatus: 'paid',
  paypalCaptureId: 'CAPTURE1',
  paypalRefundId: undefined as string | undefined,
};
const failed = { ...paid, cancelled: 1, paymentStatus: 'refund_failed', paypalRefundId: 'REFUND_OLD' };
const tour = { name: 'Haunted Savannah Ghost Tour' };

function post(fields: Record<string, string | string[]>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields))
    for (const v of [value].flat()) body.append(key, v);
  return {
    request: new Request('https://example.com/admin', { method: 'POST', body }),
    params: { bookingId: 'booking_1' },
    context: {},
  } as never;
}

function withBooking(booking: object | null) {
  vi.mocked(getBookingForOperator).mockResolvedValue(
    (booking && { booking, tour, total: 96 }) as never,
  );
}

describe('admin Booking actions', () => {
  afterEach(() => vi.clearAllMocks());

  it('marks Recent activity as seen for this browser', async () => {
    const seen = (await bookingsAction(post({ intent: 'mark-seen' }))) as never as {
      init: { headers: Record<string, string> };
    };

    expect(seen.init.headers['Set-Cookie']).toMatch(/^operator_activity_seen=/);
    await expect(bookingsAction(post({}))).resolves.toMatchObject({ init: { status: 400 } });
  });

  it('404s an unknown Booking', async () => {
    withBooking(null);
    await expect(bookingLoader(post({}))).rejects.toMatchObject({ init: { status: 404 } });
    await expect(bookingAction(post({ intent: 'cancel' }))).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it.each([
    ['cancel', 'first'],
    ['retry-refund', 'retry'],
  ])('sends %s to the refund module as a %s Operator refund', async (intent, attempt) => {
    withBooking(paid);
    vi.mocked(refundBooking).mockResolvedValue('refund_requested');

    await expect(bookingAction(post({ intent }))).resolves.toMatchObject({ ok: true });
    expect(refundBooking).toHaveBeenCalledWith({
      booking: paid,
      tour,
      total: 96,
      by: 'operator',
      attempt,
    });
  });

  it.each(['not_refundable', 'refund_failed', 'record_failed'] as const)(
    'shows a %s refund as an error',
    async (outcome) => {
      withBooking(paid);
      vi.mocked(refundBooking).mockResolvedValue(outcome);

      await expect(bookingAction(post({ intent: 'cancel' }))).resolves.toMatchObject({
        ok: false,
      });
    },
  );

  it('rejects unknown intents and marking a refund that has not failed', async () => {
    withBooking(paid);

    await expect(bookingAction(post({ intent: 'mark-refunded' }))).resolves.toMatchObject({ ok: false });
    await expect(bookingAction(post({ intent: 'nope' }))).resolves.toMatchObject({ ok: false });
    expect(markBookingRefunded).not.toHaveBeenCalled();
    expect(refundBooking).not.toHaveBeenCalled();
  });

  it('marks a failed refund as refunded outside the app', async () => {
    withBooking(failed);
    await expect(bookingAction(post({ intent: 'mark-refunded' }))).resolves.toMatchObject({ ok: true });
    expect(markBookingRefunded).toHaveBeenCalledWith('booking_1');
  });
});

describe('admin tour actions', () => {
  afterEach(() => vi.clearAllMocks());

  it('saves valid tour settings and rejects invalid ones', async () => {
    const settings = { id: 'tour_1', name: 'Ghost', price: '35', maxGuests: '18', meetingPoint: 'Reynolds Square' };

    await expect(toursAction(post({ ...settings, startTimes: [] }))).resolves.toMatchObject({ ok: false });
    await expect(
      toursAction(post({ ...settings, startTimes: ['9:00 PM', '7:30 PM'] })),
    ).resolves.toMatchObject({ ok: true });
    expect(updateTourSettings).toHaveBeenCalledOnce();
    expect(updateTourSettings).toHaveBeenCalledWith({
      id: 'tour_1',
      price: 35,
      maxGuests: 18,
      startTimes: ['7:30 PM', '9:00 PM'],
      meetingPoint: 'Reynolds Square',
    });
  });

  it('closes future dates and reopens any date', async () => {
    const fields = { tourIds: ['tour_1', 'tour_2'] };

    await expect(
      closedDatesAction(post({ ...fields, intent: 'close', date: '2000-01-01' })),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      closedDatesAction(post({ ...fields, intent: 'close', date: '2099-12-25' })),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      closedDatesAction(post({ ...fields, intent: 'reopen', date: '2000-01-01' })),
    ).resolves.toMatchObject({ ok: true });
    expect(vi.mocked(setTourDateBlocked).mock.calls).toEqual([
      [{ tourIds: ['tour_1', 'tour_2'], date: '2099-12-25', blocked: true }],
      [{ tourIds: ['tour_1', 'tour_2'], date: '2000-01-01', blocked: false }],
    ]);
  });
});
