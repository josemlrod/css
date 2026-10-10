import { getAuthSessionId, getAuthUserId } from '@convex-dev/auth/server';

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
