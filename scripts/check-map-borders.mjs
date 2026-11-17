#!/usr/bin/env node
/**
 * scripts/check-map-borders.mjs
 * ------------------------------
 * Guards the globe's borders against taking a political position the UK
 * government does not (see BORDER FIXES in generate-world-geometry.mjs).
 * Each check puts a point inside a disputed area and asks which outline it
 * falls in. Run after `npm run gen:globe`.
 *
 * Run: npm run check:map
 */

import { readFileSync } from 'node:fs';

const src = readFileSync('lib/world-geometry.ts', 'utf8');
const flat = JSON.parse(src.slice(src.indexOf('= [') + 2, src.lastIndexOf(']') + 1).replace(/,\s*\]$/, ']'));
const rings = flat.map(r => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i], r[i + 1]]); return p; });

function inRing([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const ringOf = pt => rings.findIndex(r => inRing(pt, r));
const same = (a, b) => { const i = ringOf(a), j = ringOf(b); return i >= 0 && i === j; };

const P = {
  crimea: [34.1, 45.3], kyiv: [30.5, 50.45], moscow: [37.6, 55.75],
  northCyprus: [33.6, 35.25], southCyprus: [33.0, 34.8],
  somaliland: [45.0, 9.5], mogadishu: [45.3, 2.05],
  golan: [35.75, 33.0], damascus: [36.3, 33.5], telAviv: [34.8, 32.08],
  westBank: [35.25, 31.95], gaza: [34.4, 31.45],
  kosovo: [20.9, 42.6], belgrade: [20.46, 44.8],
};

const checks = [
  ['Crimea is drawn in Ukraine', same(P.crimea, P.kyiv) && !same(P.crimea, P.moscow)],
  ['Northern Cyprus is drawn, as part of Cyprus', same(P.northCyprus, P.southCyprus)],
  ['Somaliland is drawn in Somalia', same(P.somaliland, P.mogadishu)],
  ['The Golan is drawn in Syria, not Israel', same(P.golan, P.damascus) && !same(P.golan, P.telAviv)],
  ['The West Bank is drawn, outside Israel', ringOf(P.westBank) >= 0 && !same(P.westBank, P.telAviv)],
  ['Gaza is drawn', ringOf(P.gaza) >= 0],
  ['Kosovo is its own country', ringOf(P.kosovo) >= 0 && !same(P.kosovo, P.belgrade)],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
}
if (failed) { console.error(`\n${failed} map border check(s) failed`); process.exit(1); }
console.log('\n✓ Map border checks passed');
