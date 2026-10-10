import { getAuthSessionId, getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { serverQuery } from './lib/serverFunctions';
import { isOperatorEmail } from './lib/operators';

// The Operator behind the session token the app server set. Null once they sign out
// (the JWT alone outlives its session) or their email leaves OPERATOR_ALLOWED_EMAILS.
export const getSignedInOperator = serverQuery({
  args: {},
  handler: async (ctx) => {
    const [userId, sessionId] = await Promise.all([
      getAuthUserId(ctx),
      getAuthSessionId(ctx),
    ]);
    const [user, session] = await Promise.all([
      userId ? ctx.db.get(userId) : null,
      sessionId ? ctx.db.get(sessionId) : null,
    ]);

    if (!user || !session || !isOperatorEmail(user.email)) return null;

    return { name: user.name ?? null, email: user.email };
  },
});

// Whether this email already has a password account, so a repeat sign-up can say
// "sign in instead". Convex hides thrown error messages in production, so the app asks.
export const hasPasswordAccount = serverQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) =>
        q.eq('provider', 'password').eq('providerAccountId', email),
      )
      .unique();

    return account !== null;
  },
});
