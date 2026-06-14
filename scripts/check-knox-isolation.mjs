#!/usr/bin/env node
/**
 * scripts/check-knox-isolation.mjs
 * --------------------------------
 * Guard that keeps the whole Knox Factor formula OUT of the client bundle.
 *
 * The formula ends up in the client bundle only if a client-reachable module
 * imports it. Metro bundles whole modules, so the leak happens at the IMPORT.
 * Checking the import graph is therefore deterministic, fast (no build needed),
 * and pinpoints the offending file. If the import graph is clean, the formula
 * (caps, penalties, virality cap, name bonus) cannot reach the client.
 *
 * RULE: the server-only modules below may be imported ONLY by the allowlisted
 * server files. Any other importer fails the check.
 *
 * Run:  node scripts/check-knox-isolation.mjs   (npm run check:knox)
 * Exit: 0 = clean, 1 = a client/non-allowlisted file imports the formula.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SERVER_ONLY = [
  { name: 'data/knoxFactor.server.ts', specifiers: ['@/data/knoxFactor.server', './knoxFactor.server', '../data/knoxFactor.server'] },
  { name: 'data/transformers.ts',      specifiers: ['@/data/transformers', './transformers', '../data/transformers', '../../data/transformers'] },
];

// Files allowed to import the server-only modules. Each is itself server-side
// (Expo Router +api routes run on the server) or the formula chain itself.
const ALLOWLIST = new Set([
  'data/transformers.ts',        // imports the formula; itself server-only
  'data/knoxFactor.server.ts',   // is the formula
  'app/api/ariadne+api.ts',      // server route
  'app/api/account+api.ts',      // server route
]);

const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'ios', 'android', '.vercel']);
const SKIP_TOP_LEVEL = new Set(['scripts']);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    const top = rel.split(sep)[0];
    if (SKIP_DIRS.has(entry) || SKIP_TOP_LEVEL.has(top)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

function importsAny(content, specifiers) {
  const hits = [];
  const importRe = /(?:import|export)[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(content)) !== null) {
    if (specifiers.includes(m[1])) hits.push(m[1]);
  }
  return hits;
}

const files = collect(ROOT);
const violations = [];

for (const rel of files) {
  const relPosix = rel.split(sep).join('/');
  if (ALLOWLIST.has(relPosix)) continue;
  const content = readFileSync(join(ROOT, rel), 'utf8');
  for (const target of SERVER_ONLY) {
    const hits = importsAny(content, target.specifiers);
    if (hits.length > 0) violations.push({ file: relPosix, target: target.name, via: hits.join(', ') });
  }
}

if (violations.length > 0) {
  console.error('\n✖ Knox Factor isolation FAILED — the formula is reachable from client code:\n');
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    imports server-only ${v.target}  (via "${v.via}")`);
  }
  console.error('\nFix: read precomputed values from the API payload, or use the');
  console.error('client-safe helper in data/leaderboard.ts. Never import the formula.\n');
  process.exit(1);
}

console.log(`✓ Knox Factor isolation OK — scanned ${files.length} source files, no client imports the formula.`);
process.exit(0);
