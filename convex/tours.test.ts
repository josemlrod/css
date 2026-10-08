import { beforeEach, describe, expect, it } from 'vitest';

import { getTourBySlug, seedTours } from './tours';

type TourRow = { _id: string; slug: string; name: string };

const seedHandler = (
  seedTours as unknown as {
    _handler: (ctx: never, args: { tours: Omit<TourRow, '_id'>[] }) => Promise<number>;
  }
)._handler;

const getTourBySlugHandler = (
  getTourBySlug as unknown as {
    _handler: (
      ctx: never,
      args: { slug: string; serverSecret: string },
    ) => Promise<TourRow | null>;
  }
)._handler;

function fakeCtx() {
  const rows: TourRow[] = [];
  const db = {
    query: () => ({
      withIndex: (
        _index: string,
        range: (q: { eq: (field: string, value: string) => string }) => string,
      ) => ({
        unique: async () =>
          rows.find((row) => row.slug === range({ eq: (_f, value) => value })) ??
          null,
      }),
    }),
    insert: async (_table: string, doc: Omit<TourRow, '_id'>) => {
      const _id = `tour_${rows.length + 1}`;
      rows.push({ ...doc, _id });
      return _id;
    },
    patch: async (id: string, fields: Partial<TourRow>) => {
      Object.assign(rows.find((row) => row._id === id)!, fields);
    },
  };

  return { rows, ctx: { db } as never };
}

describe('tours', () => {
  beforeEach(() => {
    process.env.CONVEX_SERVER_SECRET = 'test-server-secret';
  });

  it('reseeding updates tours in place, keeps IDs, and finds tours by slug', async () => {
    const { rows, ctx } = fakeCtx();

    await seedHandler(ctx, {
      tours: [
        { slug: 'food', name: 'Food Tour' },
        { slug: 'ghost', name: 'Ghost Tour' },
      ],
    });
    const firstIds = rows.map((row) => row._id);

    await seedHandler(ctx, {
      tours: [
        { slug: 'food', name: 'Food Tour v2' },
        { slug: 'ghost', name: 'Ghost Tour' },
        { slug: 'river', name: 'River Tour' },
      ],
    });

    expect(rows.map((row) => row._id)).toEqual([...firstIds, 'tour_3']);
    await expect(
      getTourBySlugHandler(ctx, { slug: 'food', serverSecret: 'test-server-secret' }),
    ).resolves.toMatchObject({ _id: firstIds[0], name: 'Food Tour v2' });
    await expect(
      getTourBySlugHandler(ctx, { slug: 'missing', serverSecret: 'test-server-secret' }),
    ).resolves.toBeNull();
  });
});
