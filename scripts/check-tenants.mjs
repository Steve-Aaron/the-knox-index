#!/usr/bin/env node
/**
 * scripts/check-tenants.mjs
 * -------------------------
 * Guard for the multi-tenant setup. Four checks, all deterministic:
 *
 *   1. HOST ROUTING     — every production host resolves to the right dashboard
 *   2. ACCESS RULES     — allowed domains admit, everything else does not
 *   3. GATE LEAKS       — no public data route reads the ungated base tables,
 *                         and no gated tenant's response gets a shared CDN copy
 *   4. REGION COVERAGE  — every account on a region-grouped dashboard has a
 *                         country mapping (needs BigQuery; skipped without creds)
 *
 * Run: node --experimental-strip-types scripts/check-tenants.mjs   (npm run check:tenants)
 * Exit: 0 = clean, 1 = a check failed.
 */

import './metadata/loadEnv.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTenant, isAllowedDomain, tenantById, isKnownTenant, TENANTS } from '../lib/tenants.ts';
import { projectGlobe, buildLandPath, placeMarkerCard, clampPhi, wrapLambda } from '../lib/globe.ts';
import { fmtCount } from '../lib/format.ts';
import { dataCacheHeaders } from '../lib/cacheHeaders.ts';
import { WORLD_RINGS } from '../data/../lib/world-geometry.ts';

let failures = 0;
const ok   = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };

function expect(actual, expected, label) {
  if (actual === expected) ok(`${label} → ${actual}`);
  else fail(`${label} → expected ${expected}, got ${actual}`);
}

// ── 1. Host routing ───────────────────────────────────────────────────────────
console.log('\nHost routing');
expect(resolveTenant('index.knox.digital').dashboardId,                    1, 'index.knox.digital');
expect(resolveTenant('worldleaders.index.knox.digital').dashboardId,       2, 'worldleaders.index.knox.digital');
expect(resolveTenant('WorldLeaders.Index.Knox.Digital:443').dashboardId,   2, 'mixed case + port');
expect(resolveTenant('worldleaders.some-preview.vercel.app').dashboardId,  2, 'preview subdomain');
expect(resolveTenant('localhost:8081').dashboardId,                        1, 'localhost');
expect(resolveTenant('worldleaders.localhost:8081').dashboardId,           2, 'worldleaders.localhost');
expect(resolveTenant(null).dashboardId,                                    1, 'missing host falls back to default');
expect(resolveTenant('unknown.example.com').dashboardId,                   1, 'unknown host falls back to default');

const ids = TENANTS.map(t => t.dashboardId);
expect(new Set(ids).size, ids.length, 'every tenant has a distinct dashboardId');

// ── 1b. Tenant identifiers ────────────────────────────────────────────────────
console.log('\nTenant identifiers');
expect(tenantById(2).dashboardId,        2, 'numeric dashboard id');
expect(tenantById('2').dashboardId,      2, 'dashboard id as a string');
expect(tenantById('world').dashboardId,  2, 'slug still resolves');
expect(tenantById('WORLD').dashboardId,  2, 'slug is case-insensitive');
expect(tenantById(1).dashboardId,        1, 'dashboard 1');
expect(tenantById('99').dashboardId,     1, 'unknown dashboard id falls back to default');
expect(tenantById(null).dashboardId,     1, 'null falls back to default');
expect(isKnownTenant(2),              true, 'isKnownTenant(2)');
expect(isKnownTenant('world'),        true, "isKnownTenant('world')");
expect(isKnownTenant(99),            false, 'isKnownTenant(99)');
expect(isKnownTenant(''),            false, 'isKnownTenant("")');

// ── 2. Access rules ───────────────────────────────────────────────────────────
console.log('\nAccess rules');
const world = TENANTS.find(t => t.id === 'world');
expect(world.access.mode,                                     'authenticated', 'world requires sign-in');
expect(isAllowedDomain('steve@knoxdigi.com', world),                    true,  '@knoxdigi.com admitted');
expect(isAllowedDomain('someone@knox.digital', world),                  true,  '@knox.digital admitted');
expect(isAllowedDomain('SOMEONE@KNOX.DIGITAL', world),                  true,  'domain check is case-insensitive');
expect(isAllowedDomain('client@example.com', world),                    false, 'other domains need approval');
expect(isAllowedDomain('fake@knoxdigi.com.evil.com', world),            false, 'suffix spoofing rejected');
expect(isAllowedDomain(null, world),                                    false, 'no email is not admitted');
expect(TENANTS.find(t => t.id === 'uk').access.mode,                'public',  'The Knox Index stays public');

// ── 3. Gate leaks ─────────────────────────────────────────────────────────────
console.log('\nGate leaks');
// Public data routes must read the gated sources, never the base tables.
const PUBLIC_ROUTES = ['ariadne+api.ts', 'posts+api.ts', 'account+api.ts', 'leagues+api.ts', 'benchmarks+api.ts', 'brief+api.ts'];
const BASE_TABLE_RE = /tableRef\(\s*'(account|post)'\s*\)/;

for (const file of PUBLIC_ROUTES) {
  const path = join('app/api', file);
  const src  = readFileSync(path, 'utf8');
  const leaks = src.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => BASE_TABLE_RE.test(line) && !line.includes('DEBUG') && !line.trim().startsWith('*') && !line.trim().startsWith('//'));

  // /api/ariadne?debug=1 deliberately samples raw schemas; it returns column
  // names only, no rows of another tenant's data.
  const real = leaks.filter(({ line }) => !line.includes('SELECT * FROM ${tableRef(t)} LIMIT 1'));
  if (real.length === 0) ok(`${file} uses only gated sources`);
  else real.forEach(({ line, n }) => fail(`${file}:${n} reads a base table → ${line.trim()}`));
}

// Every route that queries must resolve the tenant first.
for (const file of PUBLIC_ROUTES) {
  const src = readFileSync(join('app/api', file), 'utf8');
  if (src.includes('guardTenant(request)')) ok(`${file} calls the tenant guard`);
  else fail(`${file} does not call guardTenant()`);
}

// A CDN hit skips the function and so the guard: gated tenants must never get
// a shared copy, and routes must not hand-write shared cache headers.
const uk = TENANTS.find(t => t.id === 'uk');
expect(dataCacheHeaders(world)['Cache-Control'],                 'private, max-age=1800', 'world responses are private');
expect('Vercel-CDN-Cache-Control' in dataCacheHeaders(world),     false, 'world responses get no CDN copy');
expect('Vercel-CDN-Cache-Control' in dataCacheHeaders(uk),        true,  'uk responses are CDN-cached');
const SHARED_CACHE_RE = /'(public|s-maxage)[^']*'|Vercel-CDN-Cache-Control|CDN-Cache-Control/;
for (const file of PUBLIC_ROUTES) {
  const src = readFileSync(join('app/api', file), 'utf8');
  const hits = src.split('\n').map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => SHARED_CACHE_RE.test(line) && !line.includes('dataCacheHeaders(') && !line.trim().startsWith('//'));
  if (hits.length === 0) ok(`${file} takes shared caching only from dataCacheHeaders()`);
  else hits.forEach(({ line, n }) => fail(`${file}:${n} sets shared cache headers directly → ${line.trim()}`));
}

// ── 4. Region coverage ────────────────────────────────────────────────────────
console.log('\nRegion coverage');
const creds = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
if (!creds) {
  console.log('  – skipped (no GOOGLE_APPLICATION_CREDENTIALS in env)');
} else {
  const { BigQuery } = await import('@google-cloud/bigquery');
  const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
  const DATASET    = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
  const METADATA   = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';
  const opts = { projectId: PROJECT_ID };
  if (creds.startsWith('{')) opts.credentials = JSON.parse(creds); else opts.keyFilename = creds;
  const bq = new BigQuery(opts);

  for (const tenant of TENANTS.filter(t => t.grouping.mode === 'region')) {
    const [rows] = await bq.query({
      location: 'EU',
      query: `
        SELECT
          LTRIM(LOWER(a.profile), '@') AS handle,
          p.location.country           AS country,
          p.location.region            AS region,
          p.location.latitude          AS lat,
          p.location.longitude         AS lng
        FROM \`${PROJECT_ID}.${DATASET}.account\` a
        JOIN \`${PROJECT_ID}.${DATASET}.account_x_dashboard\` d
          ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${METADATA}.person\` p
          ON p.person_id = a.person_id
        WHERE d.dashboardId = ${tenant.dashboardId}`,
    });
    const missing = rows.filter(r => !r.country || !r.region);
    if (missing.length === 0) ok(`${tenant.id}: all ${rows.length} accounts have a country and region in metadata.person`);
    else fail(`${tenant.id}: ${missing.length} account(s) with no country or region → ${missing.map(r => r.handle).join(', ')} (re-run npm run meta:backfill -- --apply)`);

    // The globe plots these coordinates, so they have to be real ones.
    const noCoords = rows.filter(r => r.lat === null || r.lng === null);
    expect(noCoords.length, 0, `${tenant.id}: every account has coordinates for the globe`);

    const offGlobe = rows.filter(r => {
      if (r.lat === null || r.lng === null) return false;
      const VIEW_AT = { radius: 100, cx: 100, cy: 100, rotation: { lambda: r.lng, phi: r.lat } };
      const p = projectGlobe(r.lng, r.lat, VIEW_AT);
      return !p.visible || Math.hypot(p.x - VIEW_AT.cx, p.y - VIEW_AT.cy) > 1;
    });
    expect(offGlobe.length, 0, `${tenant.id}: every location centres correctly under its own rotation`);
  }
}

// ── 5. Globe projection ───────────────────────────────────────────────────────
console.log('\nGlobe projection');
const VIEW = { radius: 100, cx: 100, cy: 100, rotation: { lambda: 0, phi: 0 } };
const near = (actual, expected, label, tol = 0.5) => {
  if (Math.abs(actual - expected) <= tol) ok(`${label} → ${actual.toFixed(1)}`);
  else fail(`${label} → expected ~${expected}, got ${actual.toFixed(2)}`);
};

const centre = projectGlobe(0, 0, VIEW);
near(centre.x, 100, 'lon 0 / lat 0 sits at the centre x');
near(centre.y, 100, 'lon 0 / lat 0 sits at the centre y');
expect(centre.visible, true, 'the centre of the disc is visible');

const east = projectGlobe(90, 0, VIEW);
near(east.x, 200, 'lon 90 reaches the eastern limb');
expect(east.visible, true, 'the limb itself is visible');

const north = projectGlobe(0, 90, VIEW);
near(north.y, 0, 'lat 90 reaches the top of the disc');

expect(projectGlobe(180, 0, VIEW).visible, false, 'the antipode is hidden');
expect(projectGlobe(120, 0, VIEW).visible, false, 'lon 120 is round the back');

// Rotating east brings the far side into view.
const spun = { ...VIEW, rotation: { lambda: 180, phi: 0 } };
expect(projectGlobe(180, 0, spun).visible, true, 'rotating 180° reveals the antipode');

// Every point of the globe must land inside the disc.
let outside = 0;
for (let lon = -180; lon <= 180; lon += 15) {
  for (let lat = -90; lat <= 90; lat += 15) {
    const p = projectGlobe(lon, lat, VIEW);
    if (Math.hypot(p.x - VIEW.cx, p.y - VIEW.cy) > VIEW.radius + 0.01) outside++;
  }
}
expect(outside, 0, 'no projected point falls outside the disc');

expect(clampPhi(120), 82, 'tilt is clamped at the pole');
expect(wrapLambda(540), -180, 'longitude wraps into [-180, 180)');
expect(wrapLambda(-190), 170, 'negative longitude wraps');

const landPath = buildLandPath(VIEW, WORLD_RINGS);
expect(landPath.length > 5000, true, `land path is drawn (${landPath.length} chars)`);
expect(/[^0-9MLZ.,\-]/.test(landPath), false, 'land path has no unexpected characters');

// ── 6. Marker cards stay on screen ────────────────────────────────────────────
console.log('\nMarker cards');
const CARD = { width: 600, height: 600, cardWidth: 165, extent: 260, padding: 10 };
const place = (x, y) => placeMarkerCard({ ...CARD, x, y });

expect(place(300, 400).cardOffsetX, 0, 'a centred pin does not move its card');
expect(place(300, 400).placement, 'above', 'a centred pin keeps its card above');
expect(place(20, 400).cardOffsetX  > 0, true, 'a pin near the left edge pushes its card right');
expect(place(580, 400).cardOffsetX < 0, true, 'a pin near the right edge pulls its card left');
// Nudged exactly onto the edge padding, never further.
expect(place(20, 400).cardOffsetX, 72.5, 'the nudge is the minimum needed');
expect(place(300, 100).placement, 'below', 'no room above flips the card below');
expect(place(300, 590).placement, 'above', 'no room either way keeps it above');
expect(Math.abs(place(300, 400).cardOffsetX) <= CARD.width, true, 'the nudge is bounded');

// ── 7. Compact numbers ────────────────────────────────────────────────────────
console.log('\nCompact numbers');
expect(fmtCount(999),               '999',   '999 stays whole');
expect(fmtCount(1_234),             '1.2K',  'thousands');
expect(fmtCount(1_200_000),         '1.2M',  'millions');
expect(fmtCount(1_111_000_000),     '1.1B',  'billions do not read as 1111M');
expect(fmtCount(1_000_000_000),     '1B',    'a round billion drops its decimal');
expect(fmtCount(999_960_000),       '1B',    'rounding promotes the unit');
expect(fmtCount(2_500_000_000_000), '2.5T',  'trillions');
expect(fmtCount(-4_200),            '-4.2K', 'negatives keep their sign');
expect(fmtCount(NaN),               '0',     'non-finite input degrades safely');

console.log(failures === 0 ? '\n✓ Tenant checks passed\n' : `\n✗ ${failures} tenant check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
