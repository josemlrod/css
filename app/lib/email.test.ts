import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBookingCommunicationEmail,
  sendBookingCommunication,
  sendOperatorNotification,
} from './email';
import type { Booking, BookingId, CheckoutAttempt, CheckoutAttemptId, Tour, TourId } from './types';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

// The tour's price has since changed: what the Booker paid is $158, not 2 × $99.
const tour: Tour = {
  _id: 'tour_1' as TourId,
  _creationTime: 0,
  slug: 'savannah-food-tour',
  name: 'Savannah Food Tour',
  tagline: 'Taste Savannah',
  description: 'A food tour',
  longDescription: 'A longer food tour',
  duration: '2 hours',
  durationMinutes: 120,
  price: 99,
  maxGuests: 12,
  imageUrl: 'https://example.com/tour.jpg',
  category: 'Food',
  highlights: [],
  startTimes: ['10:00 AM'],
  meetingPoint: 'City Market',
  updatedAt: 0,
};

const checkoutAttempt: CheckoutAttempt = {
  _id: 'attempt_123' as CheckoutAttemptId,
  _creationTime: 0,
  tourId: tour._id,
  date: '2026-07-04',
  time: '10:00 AM',
  guests: 2,
  bookerName: 'Test Booker',
  bookerEmail: 'booker@example.com',
  unitPrice: 79,
  total: 158,
  currency: 'USD',
  paypalOrderId: 'ORDER123',
  paymentStatus: 'refund_pending',
  expiresAt: 0,
  accessTokenHash: 'attempt_hash',
  updatedAt: 0,
};

const booking: Booking = {
  _id: 'booking_123' as BookingId,
  _creationTime: 0,
  cancelled: null,
  date: checkoutAttempt.date,
  time: checkoutAttempt.time,
  guests: checkoutAttempt.guests,
  bookerName: checkoutAttempt.bookerName,
  bookerEmail: checkoutAttempt.bookerEmail,
  tourId: tour._id,
  checkoutAttemptId: checkoutAttempt._id,
  accessTokenHash: 'booking_hash',
  paypalCaptureId: 'CAPTURE123',
  paymentStatus: 'paid',
  updatedAt: 0,
};

const manageUrl = 'https://example.com/manage/booking_123?token=raw_token';
const newBooking = { checkoutAttempt, tour, bookingId: booking._id, manageUrl };
const paidBooking = { booking, tour, total: checkoutAttempt.total };

describe('Booking Communication email content', () => {
  it('includes paid Booking details and private manage/cancel link', () => {
    const email = createBookingCommunicationEmail('booking_communication', newBooking);

    expect(email.subject).toBe('Your Savannah Food Tour is all set');
    expect(email.text).toContain(
      'Thank you so much for booking with Cinematic Sites of Savannah.',
    );
    expect(email.text).toContain('Date: July 4, 2026');
    expect(email.text).toContain('Time: 10:00 AM');
    expect(email.text).toContain('Party size: 2');
    expect(email.text).toContain('Total: $158.00');
    expect(email.text).toContain('Meeting point: City Market');
    expect(email.text).toContain(`Manage or cancel booking: ${manageUrl}`);
    expect(email.html).toContain(
      "we can't wait to share Savannah's most iconic film locations",
    );
    expect(email.html).toContain('Cinematic Sites of Savannah Team');
    expect(email.html).toContain('Manage cancellation');
    expect(email.html).toContain(
      'src="https://cinematicsitesofsavannah.com/wp-content/uploads/2023/06/CSS-logo1.png"',
    );
    expect(email.html).toContain('alt="Cinematic Sites of Savannah"');
    expect(email.html).not.toContain('Booking Communication');
  });

  it.each([
    [
      'capacity_refund',
      { checkoutAttempt, tour },
      'Savannah Food Tour refund requested',
      'tour filled before payment completed',
    ],
    [
      'cancellation_refund_requested',
      paidBooking,
      'Savannah Food Tour cancellation received',
      'Your booking is canceled',
    ],
    [
      'cancellation_refund_failed',
      paidBooking,
      'Savannah Food Tour cancellation needs support',
      'booking is still active. Please try again later, or email info@cinematicsitesofsavannah.com or call 912-644-0361',
    ],
    [
      'refund_failed',
      paidBooking,
      'Savannah Food Tour refund needs support',
      "PayPal let us know your refund didn't go through. Please email info@cinematicsitesofsavannah.com or call 912-644-0361",
    ],
    [
      'refund_failed',
      { checkoutAttempt, tour },
      'Savannah Food Tour refund needs support',
      "PayPal let us know your refund didn't go through",
    ],
  ] as const)('explains %s to the Booker with the amount they paid', (kind, records, subject, message) => {
    const email = createBookingCommunicationEmail(kind, records as never);

    expect(email.subject).toBe(subject);
    expect(email.text).toContain('Hi Test Booker,');
    expect(email.text).toContain(message);
    expect(email.text).toContain('Refund amount: $158.00');
    expect(email.text).not.toContain('Payment Status');
  });
});

describe('Booking Communication sending', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sendMock.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.OPERATOR_EMAIL;
    delete process.env.APP_ORIGIN;
  });

  function configure() {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'tours@example.com';
    process.env.OPERATOR_EMAIL = 'operator@example.com';
    vi.spyOn(console, 'log').mockImplementation(() => {});
  }

  it('tells the operator about a new Booking with a console link and no manage link', async () => {
    configure();
    process.env.APP_ORIGIN = 'https://book.example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendBookingCommunication('booking_communication', newBooking);

    const [bookerEmail, operatorEmail] = sendMock.mock.calls.map(([email]) => email);

    expect(bookerEmail).toMatchObject({ to: 'booker@example.com' });
    expect(operatorEmail).toMatchObject({
      to: 'operator@example.com',
      subject: 'New Booking: Savannah Food Tour on July 4, 2026 at 10:00 AM',
    });
    expect(operatorEmail.text).toContain('Booker: Test Booker <booker@example.com>');
    expect(operatorEmail.text).toContain('Total: $158.00');
    expect(operatorEmail.text).toContain(
      'Open in the operator console: https://book.example.com/admin/bookings/booking_123',
    );
    expect(JSON.stringify(operatorEmail)).not.toContain('raw_token');
  });

  it('logs a Resend error result and alerts the operator without the manage link', async () => {
    configure();
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    sendMock
      .mockResolvedValueOnce({
        data: null,
        error: { name: 'validation_error', message: 'Invalid `to` field' },
      })
      .mockRejectedValueOnce(new Error('Network down'));

    await expect(
      sendBookingCommunication('booking_communication', newBooking),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'operator@example.com',
        subject: expect.stringMatching(/^Booking email failed: /),
        text: expect.stringContaining('Booking ID: booking_123'),
      }),
    );
    expect(JSON.stringify(sendMock.mock.lastCall)).not.toContain('raw_token');
    expect(consoleErrorMock.mock.calls.map(([line]) => JSON.parse(line))).toMatchObject([
      {
        event: 'email.failed',
        type: 'booking_communication',
        bookingId: 'booking_123',
        error: { message: 'validation_error: Invalid `to` field' },
      },
      {
        event: 'email.failed',
        type: 'operator_booking_email_failed',
        bookingId: 'booking_123',
        error: { message: 'Network down' },
      },
    ]);
  });

  it('emails the Booker and the operator about a failed Checkout Attempt refund', async () => {
    configure();
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendBookingCommunication('refund_failed', { checkoutAttempt, tour });

    expect(sendMock.mock.calls.map(([{ to, subject }]) => [to, subject])).toEqual([
      ['booker@example.com', 'Savannah Food Tour refund needs support'],
      ['operator@example.com', 'Refund failed: Savannah Food Tour on July 4, 2026 at 10:00 AM'],
    ]);
    expect(sendMock.mock.lastCall?.[0].text).toContain('Checkout Attempt ID: attempt_123');
    expect(sendMock.mock.lastCall?.[0].text).not.toContain('operator console');
  });

  it('only emails the Booker about a requested cancellation refund', async () => {
    configure();
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendBookingCommunication('cancellation_refund_requested', paidBooking);

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'booker@example.com' }),
    );
  });

  it('logs instead of sending an operator notification without OPERATOR_EMAIL', async () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendOperatorNotification('booker_canceled', paidBooking)).resolves.toBe(false);

    expect(sendMock).not.toHaveBeenCalled();
    expect(JSON.parse(consoleErrorMock.mock.calls[0][0])).toMatchObject({
      event: 'email.failed',
      type: 'operator_booker_canceled',
      bookingId: 'booking_123',
    });
  });
});
