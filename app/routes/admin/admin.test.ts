import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelBookingAsOperator,
  getBookingForOperator,
  markBookingRefunded,
  restartBookingRefund,
} from '~/lib/bookings';
import { sendBookingCancellationRefundRequestedCommunication } from '~/lib/email';
import { refundPayPalCapture } from '~/lib/paypal';
import { setTourDateBlocked, updateTourSettings } from '~/lib/tours';

import { action as bookingAction, loader as bookingLoader } from './booking';
import { action as bookingsAction } from './bookings';
import { action as closedDatesAction } from './closed-dates';
import { action as toursAction } from './tours';

vi.mock('~/lib/bookings', () => ({
  cancelBookingAsOperator: vi.fn(),
  getBookingForOperator: vi.fn(),
  listBookingsForOperator: vi.fn(),
  markBookingRefunded: vi.fn(),
  restartBookingRefund: vi.fn(),
}));
vi.mock('~/lib/email', () => ({
  sendBookingCancellationRefundRequestedCommunication: vi.fn(),
}));
vi.mock('~/lib/paypal', () => ({ refundPayPalCapture: vi.fn() }));
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

  it('cancels and refunds a paid Booking, then emails the Booker', async () => {
    withBooking(paid);
    vi.mocked(refundPayPalCapture).mockResolvedValue({ id: 'REFUND1', status: 'PENDING' });

    await expect(bookingAction(post({ intent: 'cancel' }))).resolves.toMatchObject({ ok: true });
    expect(refundPayPalCapture).toHaveBeenCalledWith('CAPTURE1', undefined);
    expect(cancelBookingAsOperator).toHaveBeenCalledWith({ id: 'booking_1', paypalRefundId: 'REFUND1' });
    expect(sendBookingCancellationRefundRequestedCommunication).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@example.com', total: 96 }),
      { bookingId: 'booking_1' },
    );
  });

  it('retries a failed refund with a new PayPal request ID', async () => {
    withBooking(failed);
    vi.mocked(refundPayPalCapture).mockResolvedValue({ id: 'REFUND2', status: 'COMPLETED' });

    await expect(bookingAction(post({ intent: 'retry-refund' }))).resolves.toMatchObject({ ok: true });
    expect(refundPayPalCapture).toHaveBeenCalledWith('CAPTURE1', 'refund-CAPTURE1-REFUND_OLD');
    expect(restartBookingRefund).toHaveBeenCalledWith({ id: 'booking_1', paypalRefundId: 'REFUND2' });
  });

  it('changes nothing when PayPal rejects the refund or the Booking is not refundable', async () => {
    withBooking(paid);
    vi.mocked(refundPayPalCapture).mockResolvedValue({ id: 'REFUND1', status: 'FAILED' });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(bookingAction(post({ intent: 'cancel' }))).resolves.toMatchObject({ ok: false });
    await expect(bookingAction(post({ intent: 'retry-refund' }))).resolves.toMatchObject({ ok: false });
    await expect(bookingAction(post({ intent: 'mark-refunded' }))).resolves.toMatchObject({ ok: false });
    await expect(bookingAction(post({ intent: 'nope' }))).resolves.toMatchObject({ ok: false });
    expect(refundPayPalCapture).toHaveBeenCalledTimes(1);
    expect(cancelBookingAsOperator).not.toHaveBeenCalled();
    expect(markBookingRefunded).not.toHaveBeenCalled();
    expect(sendBookingCancellationRefundRequestedCommunication).not.toHaveBeenCalled();
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
