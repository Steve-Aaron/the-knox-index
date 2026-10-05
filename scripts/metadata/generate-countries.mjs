#!/usr/bin/env node
/**
 * scripts/metadata/generate-countries.mjs
 * ---------------------------------------
 * Regenerates scripts/metadata/seed/countries.json: every country with the
 * fields a person record needs — ISO code, name, continent, our region key, and
 * a centroid to plot on the globe.
 *
 * The admin 'create person' form reads this, so someone can be created for any
 * country rather than only the 113 that happen to appear in leader-locations.
 *
 * Region assignment follows the UN geoscheme, with three deliberate departures
 * that match how the seeded 113 are already filed:
 *   - Middle East is Western Asia plus Iran, minus the Caucasus and Cyprus
 *   - Cyprus, Armenia and Azerbaijan sit with Europe, as the seeded 113 do
 *   - North Africa stays in Africa, as Algeria and Morocco already do
 *
 * Run: node scripts/metadata/generate-countries.mjs
 * Needs world-countries installed: npm i --no-save world-countries
 */

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const countries = createRequire(import.meta.url)('world-countries');

/** Western Asia entries that we do not file as Middle East. */
const NOT_MIDDLE_EAST = new Set(['AM', 'AZ', 'GE', 'CY']);
/** Outside Western Asia, but Middle East by any ordinary reading. */
const ALSO_MIDDLE_EAST = new Set(['IR']);
/** Transcontinental, filed with Europe because leader-locations already does. */
const FILED_AS_EUROPE = new Set(['CY', 'AM', 'AZ']);

const CONTINENT = {
  europe: 'Europe', africa: 'Africa', asia: 'Asia', middleeast: 'Asia',
  northamerica: 'North America', southamerica: 'South America', oceania: 'Oceania',
};

function regionFor(c) {
  const { region, subregion, cca2 } = { ...c, subregion: c.subregion ?? '' };

  if (ALSO_MIDDLE_EAST.has(cca2)) return 'middleeast';
  if (FILED_AS_EUROPE.has(cca2)) return 'europe';

  switch (region) {
    case 'Europe':   return 'europe';
    case 'Africa':   return 'africa';
    case 'Oceania':  return 'oceania';
    case 'Americas': return subregion === 'South America' ? 'southamerica' : 'northamerica';
    case 'Asia':     return subregion === 'Western Asia' && !NOT_MIDDLE_EAST.has(cca2) ? 'middleeast' : 'asia';
    default:         return 'unknown';
  }
}

const rows = countries
  .filter(c => c.independent || c.unMember || c.cca2 === 'PS')
  .map(c => {
    const region = regionFor(c);
    return {
      country_iso2: c.cca2,
      country:      c.name.common,
      continent:    CONTINENT[region] ?? '',
      region,
      latitude:     c.latlng?.[0] ?? null,
      longitude:    c.latlng?.[1] ?? null,
    };
  })
  .filter(r => r.region !== 'unknown' && r.latitude !== null)
  .sort((a, b) => a.country.localeCompare(b.country));

writeFileSync('scripts/metadata/seed/countries.json', `${JSON.stringify(rows, null, 1)}\n`);

const byRegion = rows.reduce((acc, r) => ({ ...acc, [r.region]: (acc[r.region] ?? 0) + 1 }), {});
console.log(`${rows.length} countries written to scripts/metadata/seed/countries.json`);
console.log(byRegion);
