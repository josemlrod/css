import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBookingCancellationRefundFailedEmail,
  createBookingCancellationRefundRequestedEmail,
  createBookingCommunicationEmail,
  createFailedCapacityRefundEmail,
  createRefundFailedEmail,
  sendBookingCommunication,
} from './email';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

describe('Booking Communication email content', () => {
  it('includes paid Booking details and private manage/cancel link', () => {
    const email = createBookingCommunicationEmail({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
      meetingPoint: 'City Market',
      editUrl: 'https://example.com/manage/booking_123?token=raw_token',
      cancelUrl: 'https://example.com/manage/booking_123?token=raw_token',
    });

    expect(email.subject).toBe('Your Savannah Food Tour is all set');
    expect(email.text).toContain(
      'Thank you so much for booking with Cinematic Sites of Savannah.',
    );
    expect(email.text).toContain('Date: July 4, 2026');
    expect(email.text).toContain('Time: 10:00 AM');
    expect(email.text).toContain('Party size: 2');
    expect(email.text).toContain('Total: $158.00');
    expect(email.text).toContain(
      'Manage or cancel booking: https://example.com/manage/booking_123?token=raw_token',
    );
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

  it('explains capacity refund without creating Booking language', () => {
    const email = createFailedCapacityRefundEmail({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });

    expect(email.subject).toBe('Savannah Food Tour refund requested');
    expect(email.text).toContain('tour filled before payment completed');
    expect(email.text).toContain('requested a full refund');
    expect(email.text).toContain('Refund amount: $158.00');
  });

  it('explains successful cancellation refund request', () => {
    const email = createBookingCancellationRefundRequestedEmail({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
    });

    expect(email.subject).toBe('Savannah Food Tour cancellation received');
    expect(email.text).toContain('Your Booking is canceled');
    expect(email.text).toContain('requested a full refund');
  });

  it('explains refund request failure leaves Booking active', () => {
    const email = createBookingCancellationRefundFailedEmail({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
      supportEmail: 'support@example.com',
    });

    expect(email.subject).toBe('Savannah Food Tour cancellation needs support');
    expect(email.text).toContain('Booking remains active');
    expect(email.text).toContain('support@example.com');
  });

  it('explains PayPal refund lifecycle failure', () => {
    const email = createRefundFailedEmail({
      to: 'booker@example.com',
      bookerName: 'Test Booker',
      tourName: 'Savannah Food Tour',
      date: '2026-07-04',
      time: '10:00 AM',
      guests: 2,
      total: 158,
      supportEmail: 'support@example.com',
    });

    expect(email.subject).toBe('Savannah Food Tour refund needs support');
    expect(email.text).toContain('Payment Status: refund failed');
    expect(email.text).toContain('PayPal reported that your refund failed');
    expect(email.text).toContain('support@example.com');
  });
});

describe('Booking Communication sending', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sendMock.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.OPERATOR_EMAIL;
  });

  it('logs a Resend error result and alerts the operator without the manage link', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'tours@example.com';
    process.env.OPERATOR_EMAIL = 'operator@example.com';
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
      sendBookingCommunication(
        {
          to: 'booker@example.com',
          bookerName: 'Test Booker',
          tourName: 'Savannah Food Tour',
          date: '2026-07-04',
          time: '10:00 AM',
          guests: 2,
          total: 158,
          meetingPoint: 'City Market',
          editUrl: 'https://example.com/manage/booking_123?token=raw_token',
          cancelUrl: 'https://example.com/manage/booking_123?token=raw_token',
        },
        { bookingId: 'booking_123' },
      ),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'operator@example.com',
        text: expect.stringContaining('Booking ID: booking_123'),
      }),
    );
    expect(JSON.stringify(sendMock.mock.lastCall)).not.toContain('raw_token');
    expect(consoleErrorMock.mock.calls).toEqual([
      [
        'Email send failed',
        {
          type: 'booking_communication',
          bookingId: 'booking_123',
          error: 'validation_error: Invalid `to` field',
        },
      ],
      [
        'Email send failed',
        {
          type: 'booking_communication_failed_alert',
          bookingId: 'booking_123',
          error: 'Network down',
        },
      ],
    ]);
  });
});
