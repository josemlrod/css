import { beforeEach, describe, expect, it } from 'vitest';

import { getTourBySlug, seedTours, setTourDateBlocked } from './tours';

type TourRow = {
  _id: string;
  slug: string;
  name: string;
  price?: number;
  blockedDates?: string[];
};

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
    get: async (_table: string, id: string) => rows.find((row) => row._id === id) ?? null,
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

  it('reseeding updates tours in place, keeps IDs, blocked dates, and operator settings, and finds tours by slug', async () => {
    const { rows, ctx } = fakeCtx();

    await seedHandler(ctx, {
      tours: [
        { slug: 'food', name: 'Food Tour', price: 79 },
        { slug: 'ghost', name: 'Ghost Tour' },
      ],
    });
    const firstIds = rows.map((row) => row._id);
    rows[0].blockedDates = ['2026-12-25'];
    rows[0].price = 85;

    await seedHandler(ctx, {
      tours: [
        { slug: 'food', name: 'Food Tour v2', price: 79 },
        { slug: 'ghost', name: 'Ghost Tour' },
        { slug: 'river', name: 'River Tour', price: 45 },
      ],
    });

    expect(rows.map((row) => row._id)).toEqual([...firstIds, 'tour_3']);
    await expect(
      getTourBySlugHandler(ctx, { slug: 'food', serverSecret: 'test-server-secret' }),
    ).resolves.toMatchObject({
      _id: firstIds[0],
      name: 'Food Tour v2',
      price: 85,
      blockedDates: ['2026-12-25'],
    });
    expect(rows[2].price).toBe(45);
    await expect(
      getTourBySlugHandler(ctx, { slug: 'missing', serverSecret: 'test-server-secret' }),
    ).resolves.toBeNull();
  });

  it('closes and reopens a date on the chosen tours', async () => {
    const { rows, ctx } = fakeCtx();
    await seedHandler(ctx, { tours: [{ slug: 'food', name: 'Food' }, { slug: 'ghost', name: 'Ghost' }] });
    rows[0].blockedDates = ['2026-12-31'];
    const setBlocked = (setTourDateBlocked as unknown as {
      _handler: (ctx: never, args: object) => Promise<number>;
    })._handler;
    const args = { tourIds: ['tour_1', 'tour_2', 'missing'], serverSecret: 'test-server-secret' };

    await setBlocked(ctx, { ...args, date: '2026-12-25', blocked: true });
    expect(rows.map((row) => row.blockedDates)).toEqual([['2026-12-25', '2026-12-31'], ['2026-12-25']]);

    await setBlocked(ctx, { ...args, date: '2026-12-25', blocked: false });
    expect(rows.map((row) => row.blockedDates)).toEqual([['2026-12-31'], []]);
  });
});
