import { spawnSync } from 'node:child_process';

import { tours } from './tour-catalog';

// seedTours is internal, so it runs through the Convex CLI with deploy credentials.
// Extra arguments pass through, for example `bun run seed:tours --prod`.
const result = spawnSync(
  'npx',
  [
    'convex',
    'run',
    'tours:seedTours',
    JSON.stringify({ tours }),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
