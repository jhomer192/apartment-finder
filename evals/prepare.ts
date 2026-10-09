/**
 * Builds the two inventories the eval runs against, so every version of the
 * search agent answers over identical data:
 *
 * - golden.db: a copy of the local crawl (data/dev.db) with neighborhood and
 *   area facts re-derived by the current code, as the next crawl would.
 * - hostile.db: a small synthetic inventory whose listings try to instruct the
 *   model (see hostile.ts).
 *
 * Usage: npm run eval:prepare
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { CACHE_DIR, DB_PATHS } from './paths.js';

const source = process.argv[2] ?? 'data/dev.db';
const suite = process.env.EVAL_PREPARE as 'golden' | 'hostile' | undefined;

if (!suite) {
  // Each inventory needs its own DATABASE_PATH before the server modules load,
  // so each is built in a child process.
  const { execFileSync } = await import('node:child_process');
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const name of ['golden', 'hostile'] as const) {
    for (const suffix of ['', '-wal', '-shm']) rmSync(DB_PATHS[name] + suffix, { force: true });
    if (name === 'golden') copyFileSync(source, DB_PATHS.golden);
    execFileSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, EVAL_PREPARE: name, DATABASE_PATH: DB_PATHS[name] },
    });
  }
} else if (suite === 'golden') {
  const { db } = await import('../server/db.js');
  const { areaFactsFor } = await import('../server/area.js');
  const { nearestNeighborhood } = await import('../server/scoring.js');

  // Rules and dislikes belong to whoever's crawl this was, not to the eval.
  db.exec('DELETE FROM house_rules; DELETE FROM listing_dislikes;');
  const rows = db.prepare('SELECT listing_key, payload FROM inventory').all() as {
    listing_key: string;
    payload: string;
  }[];
  const update = db.prepare('UPDATE inventory SET payload = ? WHERE listing_key = ?');
  for (const row of rows) {
    const listing = JSON.parse(row.payload);
    listing.neighborhood = nearestNeighborhood(listing.lat, listing.lng);
    listing.area = await areaFactsFor(listing.lat, listing.lng);
    update.run(JSON.stringify(listing), row.listing_key);
  }
  console.log(`golden: ${rows.length} listings re-derived into ${DB_PATHS.golden}`);
} else {
  const { storeListings } = await import('../server/inventory.js');
  const { hostileInventory } = await import('./hostile.js');
  const listings = hostileInventory();
  storeListings(listings, Date.now());
  console.log(`hostile: ${listings.length} synthetic listings into ${DB_PATHS.hostile}`);
}
