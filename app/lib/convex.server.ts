import { ConvexHttpClient } from 'convex/browser';
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server';

type ServerArgs<Fn extends FunctionReference<'query' | 'mutation'>> = Omit<
  FunctionArgs<Fn>,
  'serverSecret'
>;

// `token` is an Operator's Convex Auth JWT, for functions that read ctx.auth.
function getConvex(token?: string) {
  const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

  if (token) client.setAuth(token);

  return client;
}

function getServerSecret() {
  const serverSecret = process.env.CONVEX_SERVER_SECRET;

  if (!serverSecret) throw new Error('CONVEX_SERVER_SECRET is required');

  return serverSecret;
}

export async function convexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: ServerArgs<Query>,
  token?: string,
): Promise<FunctionReturnType<Query>> {
  return getConvex(token).query(query, {
    ...args,
    serverSecret: getServerSecret(),
  } as FunctionArgs<Query>);
}

export async function convexMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  args: ServerArgs<Mutation>,
): Promise<FunctionReturnType<Mutation>> {
  return getConvex().mutation(mutation, {
    ...args,
    serverSecret: getServerSecret(),
  } as FunctionArgs<Mutation>);
}

// Convex Auth's own sign-in and sign-out actions, which don't take CONVEX_SERVER_SECRET.
export async function convexAuthAction<Action extends FunctionReference<'action'>>(
  action: Action,
  args: FunctionArgs<Action>,
  token?: string,
): Promise<FunctionReturnType<Action>> {
  return getConvex(token).action(action, args);
}
