import { spawnSync } from 'node:child_process';

import { tours } from '../app/lib/mock-data';

const seedTours = tours.map(
  ({
    slug,
    name,
    tagline,
    description,
    longDescription,
    duration,
    durationMinutes,
    price,
    maxGuests,
    image,
    category,
    highlights,
    startTimes,
    meetingPoint,
  }) => ({
    slug,
    name,
    tagline,
    description,
    longDescription,
    duration,
    durationMinutes,
    price,
    maxGuests,
    imageUrl: image,
    category,
    highlights,
    startTimes,
    meetingPoint,
  }),
);

// seedTours is internal, so it runs through the Convex CLI with deploy credentials.
// Extra arguments pass through, for example `bun run seed:tours --prod`.
const result = spawnSync(
  'npx',
  [
    'convex',
    'run',
    'tours:seedTours',
    JSON.stringify({ tours: seedTours }),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
