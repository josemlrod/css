import { Resend } from 'resend';

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is required`);

  return value;
}

export async function sendAuthEmail(to: string, subject: string, text: string) {
  const { error } = await new Resend(requireEnv('RESEND_API_KEY')).emails.send({
    from: requireEnv('RESEND_FROM_EMAIL'),
    to,
    subject,
    text,
  });

  if (error) throw new Error(`Could not send sign-in email: ${error.message}`);
}
