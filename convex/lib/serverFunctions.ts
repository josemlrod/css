import { v } from 'convex/values';
import type { ObjectType, PropertyValidators } from 'convex/values';

import { mutation, query } from '../_generated/server';
import type { MutationCtx, QueryCtx } from '../_generated/server';

export function assertServerSecret(serverSecret: string) {
  const expected = process.env.CONVEX_SERVER_SECRET;

  if (!expected || serverSecret !== expected) {
    throw new Error('Unauthorized');
  }
}

// Public functions callable only by the app server, which passes CONVEX_SERVER_SECRET.
export function serverQuery<Args extends PropertyValidators, Output>(definition: {
  args: Args;
  handler: (ctx: QueryCtx, args: ObjectType<Args>) => Output;
}) {
  return query({
    args: { ...definition.args, serverSecret: v.string() },
    handler: (ctx, { serverSecret, ...args }) => {
      assertServerSecret(serverSecret);
      return definition.handler(ctx, args as ObjectType<Args>);
    },
  });
}

export function serverMutation<Args extends PropertyValidators, Output>(definition: {
  args: Args;
  handler: (ctx: MutationCtx, args: ObjectType<Args>) => Output;
}) {
  return mutation({
    args: { ...definition.args, serverSecret: v.string() },
    handler: (ctx, { serverSecret, ...args }) => {
      assertServerSecret(serverSecret);
      return definition.handler(ctx, args as ObjectType<Args>);
    },
  });
}
