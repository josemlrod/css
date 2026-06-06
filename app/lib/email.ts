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

Your booking is confirmed.

Tour: ${booking.tourName}
Date: ${formatDate(booking.date)}
Time: ${booking.time}
Party size: ${booking.guests}
Total: ${currency.format(booking.total)}
Meeting point: ${booking.meetingPoint}

Edit booking: ${booking.editUrl}
Cancel booking: ${booking.cancelUrl}`;
}

function bookingCommunicationHtml(booking: BookingCommunication) {
  const bookerName = escapeHtml(booking.bookerName);
  const tourName = escapeHtml(booking.tourName);
  const date = escapeHtml(formatDate(booking.date));
  const time = escapeHtml(booking.time);
  const guests = `${booking.guests} ${booking.guests === 1 ? 'guest' : 'guests'}`;
  const total = currency.format(booking.total);
  const meetingPoint = escapeHtml(booking.meetingPoint);
  const editUrl = escapeHtml(booking.editUrl);
  const cancelUrl = escapeHtml(booking.cancelUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${tourName} booking confirmed</title>
  </head>
  <body style="margin:0;background:#f7f7f7;color:#171717;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">
      Your ${tourName} booking is confirmed.
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
                  Booking confirmed
                </h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#f7f7f7;">
                  Hi ${bookerName}, your Savannah tour is reserved. We'll see you soon.
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
                    Need to cancel? <a href="${cancelUrl}" style="color:#123449;font-weight:600;">Cancel booking</a>
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

function createBookingCommunicationEmail(booking: BookingCommunication) {
  return {
    subject: `Your ${booking.tourName} booking is confirmed`,
    text: bookingCommunicationText(booking),
    html: bookingCommunicationHtml(booking),
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
