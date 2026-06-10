import { describe, expect, it } from 'vitest';

import {
  createBookingCancellationRefundFailedEmail,
  createBookingCancellationRefundRequestedEmail,
  createBookingCommunicationEmail,
  createFailedCapacityRefundEmail,
  createRefundFailedEmail,
} from './email';

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

    expect(email.subject).toBe('Your Savannah Food Tour Booking details');
    expect(email.text).toContain('Date: July 4, 2026');
    expect(email.text).toContain('Time: 10:00 AM');
    expect(email.text).toContain('Party size: 2');
    expect(email.text).toContain('Total: $158.00');
    expect(email.text).toContain(
      'Manage or cancel booking: https://example.com/manage/booking_123?token=raw_token',
    );
    expect(email.text).not.toContain('Your booking is confirmed.');
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

    expect(email.subject).toBe('Savannah Food Tour payment refunded');
    expect(email.text).toContain('tour filled before payment completed');
    expect(email.text).toContain('refunded your payment in full');
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

  it('explains Stripe refund lifecycle failure', () => {
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
    expect(email.text).toContain('support@example.com');
  });
});
