#!/usr/bin/env node
/**
 * scripts/generate-world-geometry.mjs
 * -----------------------------------
 * Generates lib/world-geometry.ts — world coastlines as raw lon/lat rings.
 *
 * The globe re-projects every frame as it spins, so it needs the geometry in
 * degrees rather than the pre-projected paths the old flat map used. Rings are
 * simplified (Douglas-Peucker in degrees) and rounded to two decimals, which is
 * about a kilometre — far finer than a 600px globe can show — to keep the
 * module small enough to ship in the client bundle.
 *
 * Source: Natural Earth 110m via world-atlas (public domain), with the
 * borders brought into line with the UK government's position (see
 * BORDER FIXES below). Natural Earth draws what is on the ground; the
 * globe must not take a side the UK does not.
 *
 * Run: npm run gen:globe
 */

import { writeFileSync } from 'node:fs';
import { feature, merge } from 'topojson-client';

const TOPO_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const OUT       = 'lib/world-geometry.ts';
/** Simplification tolerance in degrees. Bigger = fewer points, coarser coast. */
const TOLERANCE = 0.45;
/** Rings smaller than this bounding box (degrees) are dropped — specks that
 *  cost points and render as a single pixel. */
const MIN_SPAN  = 1.2;

/** Perpendicular distance from p to the segment ab, in degrees. */
function perpendicular(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker. Iterative, so a long coastline cannot blow the stack. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0, index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicular(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function span(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

// ── BORDER FIXES ─────────────────────────────────────────────────────────────
// Checked against the UK government's position (Nov 2026):
//   Crimea          part of Ukraine (Natural Earth draws it in Russia)
//   Northern Cyprus part of Cyprus (Natural Earth draws a separate country)
//   Somaliland      part of Somalia (Natural Earth draws a separate country)
//   Golan Heights   Syrian territory (Natural Earth draws it in Israel)
//   West Bank, Gaza always drawn, though below the size cut-off (Gaza is not
//                   in the 110m data at all, so its outline is added here)
// Left as Natural Earth draws them, in line with the UK: Kosovo, Palestine,
// Western Sahara, Taiwan, the Falklands, Abkhazia and South Ossetia (inside
// Georgia), Transnistria (Moldova), Donetsk and Luhansk (Ukraine).

/** Gaza, simplified from Natural Earth 10m (UK view). Not in the 110m set. */
const GAZA = [[34.48,31.58],[34.53,31.52],[34.48,31.49],[34.35,31.34],[34.32,31.26],[34.23,31.26],[34.22,31.33],[34.3,31.41],[34.44,31.53],[34.48,31.58]];

/**
 * The Golan's western edge: the Israel-Syria line before 1967, which at this
 * map's scale runs at about 35.62°E from Lake Tiberias to Mount Hermon.
 * Israel's points east of it (north of the lake) move onto it, so the Golan
 * leaves Israel; Syria's outline is routed along the same line to Mount
 * Hermon (where Lebanon's outline starts), so the Golan is drawn in Syria.
 */
const GOLAN = { lon: 35.62, south: 32.70, north: 33.40 };
/** Syria's edge along the Golan, south to north, ending at Mount Hermon. */
const GOLAN_EDGE = [[35.62, 32.71], [35.62, 33.28], [35.82, 33.28]];

const CRIMEA_POINT = [34.1, 45.3];

const topo       = await fetch(TOPO_URL).then(r => r.json());
const geoms      = topo.objects.countries.geometries;
const byName     = name => geoms.find(g => g.properties?.name === name);

function inRing([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Crimea: take its polygon out of Russia and give it to Ukraine
const russia = byName('Russia');
const russiaPolys = feature(topo, russia).geometry.coordinates;
const crimeaIdx = russiaPolys.findIndex(p => inRing(CRIMEA_POINT, p[0]));
if (crimeaIdx < 0) throw new Error('Crimea polygon not found in Russia');
const crimeaArcs = russia.arcs[crimeaIdx];
russia.arcs = russia.arcs.filter((_, i) => i !== crimeaIdx);

/** One country made of several Natural Earth geometries (shared borders dissolved). */
function merged(name, parts) {
  return { type: 'Feature', properties: { name }, geometry: merge(topo, parts) };
}

const ukraine    = byName('Ukraine');
const cyprus     = byName('Cyprus'),   nCyprus    = byName('N. Cyprus');
const somalia    = byName('Somalia'),  somaliland = byName('Somaliland');
const replaced   = new Set([ukraine, cyprus, nCyprus, somalia, somaliland]);

const features = [
  ...geoms.filter(g => !replaced.has(g)).map(g => feature(topo, g)),
  merged('Ukraine', [ukraine, { type: 'Polygon', arcs: crimeaArcs }]),
  merged('Cyprus',  [cyprus, nCyprus]),
  merged('Somalia', [somalia, somaliland]),
];

/** Puts the Golan in Syria (see GOLAN), on the simplified outlines. */
function fixGolan(name, ring) {
  if (name === 'Israel') {
    return ring.map(([lon, lat]) =>
      lat >= GOLAN.south && lat <= GOLAN.north && lon > GOLAN.lon ? [GOLAN.lon, lat] : [lon, lat]);
  }
  if (name === 'Syria') {
    // Syria's south-west corner at the lake: route from it along the Golan
    // edge before the outline continues north.
    const i = ring.findIndex(([lon, lat]) => lat >= GOLAN.south && lat <= GOLAN.north && lon < 36);
    if (i < 0) throw new Error('Syria corner by the Golan not found');
    const corner = ring[i];
    const out = [...ring.slice(0, i + 1), ...GOLAN_EDGE, ...ring.slice(i + 1)];
    // A closed ring repeats its first point last: keep that true
    if (i === 0) out[out.length - 1] = corner;
    return out;
  }
  return ring;
}

/** Always drawn, whatever their size: dropping them would itself say something. */
const ALWAYS_KEEP = new Set(['Palestine', 'Cyprus']);

const rings = [];
for (const f of features) {
  const name = f.properties?.name;
  const geom = f.geometry;
  if (!geom) continue;
  const polygons = geom.type === 'Polygon' ? [geom.coordinates]
                 : geom.type === 'MultiPolygon' ? geom.coordinates
                 : [];
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring || ring.length < 4) continue;
    const keep = ALWAYS_KEEP.has(name);
    if (!keep && span(ring) < MIN_SPAN) continue;
    // Small kept shapes get a finer tolerance so they stay recognisable
    const simplified = fixGolan(name, simplify(ring, keep ? TOLERANCE / 4 : TOLERANCE));
    if (simplified.length < 4) continue;
    rings.push(simplified);
  }
}
rings.push(GAZA);

rings.sort((a, b) => b.length - a.length);

const points = rings.reduce((n, r) => n + r.length, 0);
const body = rings
  .map(r => `  [${r.map(([lon, lat]) => `${+lon.toFixed(2)},${+lat.toFixed(2)}`).join(', ')}],`)
  .join('\n');

const file = `/**
 * lib/world-geometry.ts
 * ----------------------
 * GENERATED by scripts/generate-world-geometry.mjs — do not edit by hand.
 *
 * World coastlines as raw longitude/latitude, for the globe to re-project on
 * every frame as it spins. Each ring is a flat array: [lon, lat, lon, lat, …].
 *
 * Simplified at ${TOLERANCE}° and rounded to 2 decimals — about a kilometre,
 * well below what a 600px globe can render — which is what keeps this module
 * small enough to ship to the browser.
 *
 * Generated: ${new Date().toISOString().slice(0, 10)} · ${rings.length} rings · ${points} points
 */

/** Flat [lon, lat, lon, lat, …] rings, largest landmass first. */
export const WORLD_RINGS: readonly (readonly number[])[] = [
${body}
];
`;

writeFileSync(OUT, file);
console.log(`✓ ${OUT} — ${rings.length} rings, ${points} points, ${(file.length / 1024).toFixed(0)}KB`);
