import Resend from '@auth/core/providers/resend';
import { Email } from '@convex-dev/auth/providers/Email';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

import { sendAuthEmail } from './lib/authEmail';
import { isOperatorEmail } from './lib/operators';

const MagicLink = Resend({
  id: 'magic-link',
  maxAge: 60 * 60,
  async sendVerificationRequest({ identifier, url }) {
    await sendAuthEmail(
      identifier,
      'Sign in to the operator console',
      `Open this link to sign in to the Cinematic Sites of Savannah operator console:\n\n${url}\n\nThe link works once and expires in 1 hour. If you didn't ask for it, ignore this email.`,
    );
  },
});

// Proves a new password account owns its email before it gets a session.
const PasswordCode = Email({
  id: 'password-code',
  maxAge: 15 * 60,
  async generateVerificationToken() {
    return Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => n % 10).join('');
  },
  async sendVerificationRequest({ identifier, token }) {
    await sendAuthEmail(
      identifier,
      `${token} is your operator console code`,
      `Enter this code to finish setting up your operator console account:\n\n${token}\n\nIt expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    );
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const name = String(params.name ?? '').trim();

        return {
          email: String(params.email ?? '').trim().toLowerCase(),
          ...(name ? { name } : {}),
        };
      },
      verify: PasswordCode,
    }),
    MagicLink,
  ],
  callbacks: {
    // Runs inside the sign-up mutation, so throwing rolls back the new user and account.
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const user = await ctx.db.get(userId);

      if (!isOperatorEmail(user?.email)) throw new Error('Not an operator email');
    },
  },
});
