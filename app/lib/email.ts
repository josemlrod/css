import { Resend } from 'resend';

import { SUPPORT_EMAIL, SUPPORT_PHONE } from '~/lib/contact';
import { logError, logEvent } from '~/lib/log';

type BookingCommunication = {
  to: string;
  bookerName: string;
  tourName: string;
  date: string;
  time: string;
  guests: number;
  total: number;
  meetingPoint: string;
  editUrl: string;
  cancelUrl: string;
};

type FailedCapacityRefundCommunication = {
  to: string;
  bookerName: string;
  tourName: string;
  date: string;
  time: string;
  guests: number;
  total: number;
};

type CancellationRefundCommunication = FailedCapacityRefundCommunication;

type RefundFailedCommunication = FailedCapacityRefundCommunication;

const supportContact = `email ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE}`;

// Logged with every send failure so it can be traced to a Booking or Checkout Attempt.
type EmailRecord = { bookingId: string } | { checkoutAttemptId: string };

type Email = { subject: string; text: string; html?: string };

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bookingCommunicationText(booking: BookingCommunication) {
  return `Hi there! Thank you so much for booking with Cinematic Sites of Savannah. We're excited to have you join us!

Your tour is all set, and we can't wait to share Savannah's most iconic film locations and behind-the-scenes stories with you. If you have any questions before the tour, need directions, or have special requests, feel free to reach out anytime.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Total: ${currency.format(booking.total)}
Meeting point: ${booking.meetingPoint}

We look forward to exploring the city with you and giving you a fun, memorable experience!

See you soon,
Cinematic Sites of Savannah Team

Manage or cancel booking: ${booking.cancelUrl}`;
}

function bookingCommunicationHtml(booking: BookingCommunication) {
  const tourName = escapeHtml(booking.tourName);
  const date = escapeHtml(formatDate(booking.date));
  const time = escapeHtml(booking.time);
  const guests = `${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}`;
  const total = currency.format(booking.total);
  const meetingPoint = escapeHtml(booking.meetingPoint);
  const cancelUrl = escapeHtml(booking.cancelUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your ${tourName} is all set</title>
  </head>
  <body style="margin:0;background:#f7f7f7;color:#171717;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">
      Your ${tourName} is all set.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:26px 28px 20px;background:#123449;">
                <img src="https://cinematicsitesofsavannah.com/wp-content/uploads/2023/06/CSS-logo1.png" width="270" alt="Cinematic Sites of Savannah" style="display:block;width:270px;max-width:100%;height:auto;border:0;border-radius:4px;" />
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px;">
                <h1 style="margin:0;color:#123449;font-size:30px;line-height:1.15;font-weight:700;">
                  Your tour is all set
                </h1>
                <p style="margin:13px 0 0;font-size:16px;line-height:1.65;color:#171717;">
                  Hi there! Thank you so much for booking with Cinematic Sites of Savannah. We're excited to have you join us!
                </p>
                <p style="margin:18px 0 22px;font-size:15px;line-height:1.65;color:#404040;">
                  Your tour is all set, and we can't wait to share Savannah's most iconic film locations and behind-the-scenes stories with you. If you have any questions before the tour, need directions, or have special requests, feel free to reach out anytime.
                </p>

                <h2 style="margin:0 0 16px;font-size:18px;line-height:1.3;color:#171717;">
                  ${tourName}
                </h2>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;background:#ffffff;">
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e5e5;color:#737373;font-size:14px;">Date</td>
                    <td align="right" style="padding:16px;border-bottom:1px solid #e5e5e5;font-weight:600;font-size:14px;color:#171717;">${date}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e5e5;color:#737373;font-size:14px;">Time</td>
                    <td align="right" style="padding:16px;border-bottom:1px solid #e5e5e5;font-weight:600;font-size:14px;color:#171717;">${time}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e5e5;color:#737373;font-size:14px;">Party size</td>
                    <td align="right" style="padding:16px;border-bottom:1px solid #e5e5e5;font-weight:600;font-size:14px;color:#171717;">${guests}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px;color:#737373;font-size:14px;">Total</td>
                    <td align="right" style="padding:16px;font-size:20px;font-weight:700;color:#171717;">${total}</td>
                  </tr>
                </table>

                <div style="margin-top:18px;padding:18px;border-radius:8px;background:#b7d1dc;border:1px solid #a8c5d1;">
                  <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#123449;">
                    Meeting point
                  </p>
                  <p style="margin:0;font-size:16px;line-height:1.5;font-weight:600;color:#171717;">
                    ${meetingPoint}
                  </p>
                </div>

                <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#171717;">
                  We look forward to exploring the city with you and giving you a fun, memorable experience!
                </p>
                <p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#171717;">
                  See you soon,<br />
                  Cinematic Sites of Savannah Team
                </p>

                <div style="margin-top:26px;">
                  <p style="margin:16px 0 0;font-size:14px;color:#737373;line-height:1.5;">
                    Need to cancel? <a href="${cancelUrl}" style="color:#123449;font-weight:600;">Manage cancellation</a>
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="height:7px;background:#dc7b32;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function createBookingCommunicationEmail(booking: BookingCommunication) {
  return {
    subject: `Your ${booking.tourName} is all set`,
    text: bookingCommunicationText(booking),
    html: bookingCommunicationHtml(booking),
  };
}

export function createFailedCapacityRefundEmail(
  booking: FailedCapacityRefundCommunication,
) {
  const details = `Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Refund amount: ${currency.format(booking.total)}`;

  return {
    subject: `${booking.tourName} refund requested`,
    text: `Hi ${booking.bookerName},

Your selected tour filled before payment completed. We requested a full refund to your original payment method.

${details}`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(booking.tourName)} refund requested</title></head>
  <body style="font-family:Arial,sans-serif;color:#171717;">
    <h1>Refund requested</h1>
    <p>Hi ${escapeHtml(booking.bookerName)}, your selected tour filled before payment completed. We requested a full refund to your original payment method.</p>
    <p><strong>Tour:</strong> ${escapeHtml(booking.tourName)}<br />
    <strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}<br />
    <strong>Time:</strong> ${escapeHtml(booking.time)}<br />
    <strong>Party size:</strong> ${booking.guests}<br />
    <strong>Refund amount:</strong> ${currency.format(booking.total)}</p>
  </body>
</html>`,
  };
}

export function createBookingCancellationRefundRequestedEmail(
  booking: CancellationRefundCommunication,
) {
  return {
    subject: `${booking.tourName} cancellation received`,
    text: `Hi ${booking.bookerName},

Your booking is canceled. We requested a full refund to your original payment method.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Refund amount: ${currency.format(booking.total)}`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(booking.tourName)} cancellation received</title></head>
  <body style="font-family:Arial,sans-serif;color:#171717;">
    <h1>Booking canceled</h1>
    <p>Hi ${escapeHtml(booking.bookerName)}, your booking is canceled. We requested a full refund to your original payment method.</p>
    <p><strong>Tour:</strong> ${escapeHtml(booking.tourName)}<br />
    <strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}<br />
    <strong>Time:</strong> ${escapeHtml(booking.time)}<br />
    <strong>Party size:</strong> ${booking.guests}<br />
    <strong>Refund amount:</strong> ${currency.format(booking.total)}</p>
  </body>
</html>`,
  };
}

export function createBookingCancellationRefundFailedEmail(
  booking: CancellationRefundCommunication,
) {
  return {
    subject: `${booking.tourName} cancellation needs support`,
    text: `Hi ${booking.bookerName},

We couldn't process your refund, so your booking is still active. Please try again later, or ${supportContact} and we'll help.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Refund amount: ${currency.format(booking.total)}`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(booking.tourName)} cancellation needs support</title></head>
  <body style="font-family:Arial,sans-serif;color:#171717;">
    <h1>Cancellation needs support</h1>
    <p>Hi ${escapeHtml(booking.bookerName)}, we couldn't process your refund, so your booking is still active. Please try again later, or ${escapeHtml(supportContact)} and we'll help.</p>
    <p><strong>Tour:</strong> ${escapeHtml(booking.tourName)}<br />
    <strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}<br />
    <strong>Time:</strong> ${escapeHtml(booking.time)}<br />
    <strong>Party size:</strong> ${booking.guests}<br />
    <strong>Refund amount:</strong> ${currency.format(booking.total)}</p>
  </body>
</html>`,
  };
}

export function createRefundFailedEmail(booking: RefundFailedCommunication) {
  return {
    subject: `${booking.tourName} refund needs support`,
    text: `Hi ${booking.bookerName},

PayPal let us know your refund didn't go through. Please ${supportContact} and we'll sort it out.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Refund amount: ${currency.format(booking.total)}`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(booking.tourName)} refund needs support</title></head>
  <body style="font-family:Arial,sans-serif;color:#171717;">
    <h1>Refund needs support</h1>
    <p>Hi ${escapeHtml(booking.bookerName)}, PayPal let us know your refund didn't go through. Please ${escapeHtml(supportContact)} and we'll sort it out.</p>
    <p><strong>Tour:</strong> ${escapeHtml(booking.tourName)}<br />
    <strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}<br />
    <strong>Time:</strong> ${escapeHtml(booking.time)}<br />
    <strong>Party size:</strong> ${booking.guests}<br />
    <strong>Refund amount:</strong> ${currency.format(booking.total)}</p>
  </body>
</html>`,
  };
}

type OperatorEvent =
  | 'new_booking'
  | 'booking_email_failed'
  | 'booker_canceled'
  | 'cancellation_refund_failed'
  | 'capacity_refund'
  | 'refund_failed';

type OperatorNotification = FailedCapacityRefundCommunication;

const operatorEvents: Record<
  OperatorEvent,
  { subject: string; message: (record: EmailRecord) => string }
> = {
  new_booking: {
    subject: 'New Booking',
    message: () => 'A new Booking just came in. The Booker has their confirmation email.',
  },
  booking_email_failed: {
    subject: 'Booking email failed',
    message: () =>
      'The Booking email for this new Booking could not be sent. The Booker has no link to manage or cancel online, so please contact them directly.',
  },
  booker_canceled: {
    subject: 'Booking canceled',
    message: () =>
      'The Booker canceled online. PayPal is refunding the full amount, and their spots are open again.',
  },
  cancellation_refund_failed: {
    subject: 'Cancellation needs you',
    message: () =>
      "The Booker tried to cancel, but PayPal didn't accept the refund, so the Booking is still active. Cancel and refund it from the operator console, or contact the Booker.",
  },
  capacity_refund: {
    subject: 'Tour full, payment refunded',
    message: () =>
      'This time slot filled before the payment finished, so no Booking was made. We requested a full refund and emailed the Booker.',
  },
  refund_failed: {
    subject: 'Refund failed',
    message: (record) =>
      'bookingId' in record
        ? 'PayPal says the refund for this canceled Booking failed. Retry it from the operator console, or refund in PayPal.'
        : "This time slot filled before the payment finished, so no Booking was made, but PayPal didn't accept the refund. Refund the Booker in PayPal and let them know.",
  },
};

// Signed-in Operators land on the Booking; everyone else signs in first and comes back.
function operatorBookingUrl(bookingId: string) {
  const path = `/admin/bookings/${bookingId}`;
  const origin = process.env.APP_ORIGIN;

  return origin ? new URL(path, origin).toString() : path;
}

// Never includes the manage link: it carries the Booker's access token.
export function createOperatorNotificationEmail(
  event: OperatorEvent,
  booking: OperatorNotification,
  record: EmailRecord,
) {
  const { subject, message } = operatorEvents[event];
  const consoleUrl =
    'bookingId' in record ? operatorBookingUrl(record.bookingId) : null;
  const details: [string, string][] = [
    'bookingId' in record
      ? ['Booking ID', record.bookingId]
      : ['Checkout Attempt ID', record.checkoutAttemptId],
    ['Booker', `${booking.bookerName} <${booking.to}>`],
    ['Tour', booking.tourName],
    ['Date', formatDate(booking.date)],
    ['Time', booking.time],
    ['Party size', String(booking.guests)],
    ['Total', currency.format(booking.total)],
  ];
  const fullSubject = `${subject}: ${booking.tourName} on ${formatDate(booking.date)} at ${booking.time}`;
  const rows = details
    .map(
      ([label, value], index) => `<tr>
                  <td style="padding:10px 14px;${index ? 'border-top:1px solid #e5e5e5;' : ''}color:#737373;font-size:14px;">${label}</td>
                  <td align="right" style="padding:10px 14px;${index ? 'border-top:1px solid #e5e5e5;' : ''}font-size:14px;font-weight:600;color:#171717;">${escapeHtml(value)}</td>
                </tr>`,
    )
    .join('\n                ');

  return {
    subject: fullSubject,
    text: `${message(record)}

${details.map(([label, value]) => `${label}: ${value}`).join('\n')}${
      consoleUrl ? `\n\nOpen in the operator console: ${consoleUrl}` : ''
    }`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(fullSubject)}</title></head>
  <body style="margin:0;background:#f7f7f7;color:#171717;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">
            <tr>
              <td style="padding:24px;">
                <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">Operator</p>
                <h1 style="margin:6px 0 0;font-size:22px;line-height:1.25;color:#123449;">${escapeHtml(subject)}</h1>
                <p style="margin:10px 0 18px;font-size:15px;line-height:1.55;color:#404040;">${escapeHtml(message(record))}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;">
                ${rows}
                </table>${
                  consoleUrl
                    ? `
                <a href="${escapeHtml(consoleUrl)}" style="display:inline-block;margin-top:18px;padding:10px 16px;border-radius:6px;background:#123449;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Open in the operator console</a>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

async function sendEmail(
  type: string,
  record: EmailRecord,
  to: string,
  email: Email,
) {
  try {
    const resend = new Resend(requireEnv('RESEND_API_KEY'));
    const { error } = await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to,
      ...email,
    });

    if (!error) {
      logEvent('email.sent', { type, ...record });
      return true;
    }

    logError('email.failed', new Error(`${error.name}: ${error.message}`), {
      type,
      ...record,
    });
  } catch (error) {
    logError('email.failed', error, { type, ...record });
  }

  return false;
}

// Tells the operator about a Booking event. Never throws, so it can't change a payment
// or cancellation response.
export async function sendOperatorNotification(
  event: OperatorEvent,
  booking: OperatorNotification,
  record: EmailRecord,
) {
  const type = `operator_${event}`;
  const to = process.env.OPERATOR_EMAIL;

  if (!to) {
    logError('email.failed', new Error('OPERATOR_EMAIL is required'), {
      type,
      ...record,
    });
    return false;
  }

  return sendEmail(
    type,
    record,
    to,
    createOperatorNotificationEmail(event, booking, record),
  );
}

export async function sendBookingCommunication(
  booking: BookingCommunication,
  record: { bookingId: string },
) {
  const sent = await sendEmail(
    'booking_communication',
    record,
    booking.to,
    createBookingCommunicationEmail(booking),
  );

  await sendOperatorNotification(
    sent ? 'new_booking' : 'booking_email_failed',
    booking,
    record,
  );
}

export async function sendFailedCapacityRefundCommunication(
  booking: FailedCapacityRefundCommunication,
  record: { checkoutAttemptId: string },
) {
  await Promise.all([
    sendEmail(
      'capacity_refund',
      record,
      booking.to,
      createFailedCapacityRefundEmail(booking),
    ),
    sendOperatorNotification('capacity_refund', booking, record),
  ]);
}

export async function sendBookingCancellationRefundRequestedCommunication(
  booking: CancellationRefundCommunication,
  record: { bookingId: string },
) {
  await sendEmail(
    'cancellation_refund_requested',
    record,
    booking.to,
    createBookingCancellationRefundRequestedEmail(booking),
  );
}

export async function sendBookingCancellationRefundFailedCommunication(
  booking: CancellationRefundCommunication,
  record: { bookingId: string },
) {
  await Promise.all([
    sendEmail(
      'cancellation_refund_failed',
      record,
      booking.to,
      createBookingCancellationRefundFailedEmail(booking),
    ),
    sendOperatorNotification('cancellation_refund_failed', booking, record),
  ]);
}

export async function sendRefundFailedCommunication(
  booking: RefundFailedCommunication,
  record: EmailRecord,
) {
  await Promise.all([
    sendEmail(
      'refund_failed',
      record,
      booking.to,
      createRefundFailedEmail(booking),
    ),
    sendOperatorNotification('refund_failed', booking, record),
  ]);
}
