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
  return `<p>Hi ${booking.bookerName},</p>
<p>Your booking is confirmed.</p>
<dl>
  <dt>Tour</dt><dd>${booking.tourName}</dd>
  <dt>Date</dt><dd>${formatDate(booking.date)}</dd>
  <dt>Time</dt><dd>${booking.time}</dd>
  <dt>Party size</dt><dd>${booking.guests}</dd>
  <dt>Total</dt><dd>${currency.format(booking.total)}</dd>
  <dt>Meeting point</dt><dd>${booking.meetingPoint}</dd>
</dl>
<p><a href="${booking.editUrl}">Edit booking</a></p>
<p><a href="${booking.cancelUrl}">Cancel booking</a></p>`;
}

export async function sendBookingCommunication(booking: BookingCommunication) {
  console.log('sendingBookingCommunication');
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  console.log('resend', resend);

  try {
    await resend.emails.send({
      from: requireEnv('RESEND_FROM_EMAIL'),
      to: booking.to,
      subject: `Your ${booking.tourName} booking`,
      text: bookingCommunicationText(booking),
      html: bookingCommunicationHtml(booking),
    });
    console.log('sent email');
  } catch (e) {
    console.log('e', e);
  }
}
