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

function getConvex() {
  return new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
}

function getServerSecret() {
  const serverSecret = process.env.CONVEX_SERVER_SECRET;

  if (!serverSecret) throw new Error('CONVEX_SERVER_SECRET is required');

  return serverSecret;
}

export async function convexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: ServerArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  return getConvex().query(query, {
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
