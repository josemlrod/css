import { getFunctionName, type FunctionReference } from 'convex/server';

type ConvexMock = { mock: { calls: [FunctionReference<'query' | 'mutation'>, ...unknown[]][] } };

// Every Convex `api` reference compares equal to every other, so tests check calls by
// function name: [['bookings:markBookingRefunded', { id }]].
export function convexCalls({ mock }: ConvexMock) {
  return mock.calls.map(([fn, args]) => [getFunctionName(fn), args]);
}
