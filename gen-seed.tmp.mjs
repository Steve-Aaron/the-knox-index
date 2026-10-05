import { writeFileSync } from 'node:fs';
import { LEADER_LOCATIONS } from './data/leaderRegions.ts';

// One-off: turn the generated TS module into a plain data seed the backfill can
// read, so the TS module can leave the app bundle for good.
const countries = await fetch('https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json').then(r => r.json());
const byIso = new Map(countries.map(c => [c.cca2, c]));

const seed = {};
for (const [handle, l] of Object.entries(LEADER_LOCATIONS)) {
  seed[handle] = {
    country_iso2: l.iso2,
    country:      l.country,
    continent:    byIso.get(l.iso2)?.region ?? '',
    region:       l.region,
    latitude:     l.lat,
    longitude:    l.lng,
  };
}
writeFileSync('scripts/metadata/seed/leader-locations.json', JSON.stringify(seed, null, 1));
console.log(`✓ seed written: ${Object.keys(seed).length} handles`);
