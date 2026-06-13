import { Resend } from 'resend';

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

type CancellationRefundCommunication = FailedCapacityRefundCommunication & {
  supportEmail?: string;
};

type RefundFailedCommunication = FailedCapacityRefundCommunication & {
  supportEmail?: string;
};

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
  return `Hi ${booking.bookerName},

Your Booking details are ready.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Total: ${currency.format(booking.total)}
Meeting point: ${booking.meetingPoint}

Manage or cancel booking: ${booking.cancelUrl}`;
}

function bookingCommunicationHtml(booking: BookingCommunication) {
  const bookerName = escapeHtml(booking.bookerName);
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
    <title>${tourName} Booking details</title>
  </head>
  <body style="margin:0;background:#f7f7f7;color:#171717;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">
      Your ${tourName} Booking details are ready.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;background:#123449;color:#ffffff;">
                <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#dc7b32;">
                  Booking Communication
                </p>
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:600;">
                  Booking details ready
                </h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#f7f7f7;">
                  Hi ${bookerName}, your Savannah tour is reserved. Stripe will send payment receipt separately.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px;">
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

                <div style="margin-top:26px;">
                  <p style="margin:16px 0 0;font-size:14px;color:#737373;line-height:1.5;">
                    Need to cancel? <a href="${cancelUrl}" style="color:#123449;font-weight:600;">Manage cancellation</a>
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px;background:#f7f7f7;color:#737373;font-size:13px;line-height:1.5;border-top:1px solid #e5e5e5;">
                Keep this email handy. Your guide will meet you at the meeting point listed above.
              </td>
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
    subject: `Your ${booking.tourName} Booking details`,
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
    subject: `${booking.tourName} payment refunded`,
    text: `Hi ${booking.bookerName},

Your selected tour filled before payment completed. We refunded your payment in full.

${details}`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(booking.tourName)} payment refunded</title></head>
  <body style="font-family:Arial,sans-serif;color:#171717;">
    <h1>Payment refunded</h1>
    <p>Hi ${escapeHtml(booking.bookerName)}, your selected tour filled before payment completed. We refunded your payment in full.</p>
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

Your Booking is canceled. We requested a full refund to your original payment method.

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
    <p>Hi ${escapeHtml(booking.bookerName)}, your Booking is canceled. We requested a full refund to your original payment method.</p>
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
  const supportEmail = booking.supportEmail ?? 'support';

  return {
    subject: `${booking.tourName} cancellation needs support`,
    text: `Hi ${booking.bookerName},

We could not request your refund, so your Booking remains active. Please try again or contact ${supportEmail} for help.

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
    <p>Hi ${escapeHtml(booking.bookerName)}, we could not request your refund, so your Booking remains active. Please try again or contact ${escapeHtml(supportEmail)} for help.</p>
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
  const supportEmail = booking.supportEmail ?? 'support';

  return {
    subject: `${booking.tourName} refund needs support`,
    text: `Hi ${booking.bookerName},

Stripe reported that your refund failed. Your Booking Communication record now shows Payment Status: refund failed. Please contact ${supportEmail} for help.

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
    <p>Hi ${escapeHtml(booking.bookerName)}, Stripe reported that your refund failed. Your Booking Communication record now shows Payment Status: refund failed. Please contact ${escapeHtml(supportEmail)} for help.</p>
    <p><strong>Tour:</strong> ${escapeHtml(booking.tourName)}<br />
    <strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}<br />
    <strong>Time:</strong> ${escapeHtml(booking.time)}<br />
    <strong>Party size:</strong> ${booking.guests}<br />
    <strong>Refund amount:</strong> ${currency.format(booking.total)}</p>
  </body>
</html>`,
  };
}

export async function sendBookingCommunication(booking: BookingCommunication) {
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const email = createBookingCommunicationEmail(booking);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {}
}

export async function sendFailedCapacityRefundCommunication(
  booking: FailedCapacityRefundCommunication,
) {
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const email = createFailedCapacityRefundEmail(booking);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {}
}

export async function sendBookingCancellationRefundRequestedCommunication(
  booking: CancellationRefundCommunication,
) {
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const email = createBookingCancellationRefundRequestedEmail(booking);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {}
}

export async function sendBookingCancellationRefundFailedCommunication(
  booking: CancellationRefundCommunication,
) {
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const email = createBookingCancellationRefundFailedEmail(booking);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {}
}

export async function sendRefundFailedCommunication(
  booking: RefundFailedCommunication,
) {
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const email = createRefundFailedEmail(booking);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {}
}
