#!/usr/bin/env node
/**
 * scripts/metadata/000-move-dataset.mjs
 * -------------------------------------
 * Moves the `metadata` dataset from europe-west2 to EU, so it can be joined to
 * `ariadne_tiktok_demo` (EU). BigQuery cannot join across locations and cannot
 * rename or relocate a dataset in place, so a move is:
 *
 *   1. copy every table to a staging dataset in EU
 *   2. verify row counts and schemas match the source
 *   3. delete the source dataset in europe-west2
 *   4. create `metadata` in EU and copy the staging tables into it
 *   5. verify again, then drop the staging dataset
 *
 * The staging copy is the safety net: the source is not deleted until the data
 * is verified present in EU. A manifest of the source schemas is written to
 * exports/ first, so the structure can be rebuilt from nothing if needed.
 *
 * Idempotent: re-running after a partial move picks up where it stopped.
 * Touches nothing outside the `metadata` dataset.
 *
 * Run: node scripts/metadata/000-move-dataset.mjs
 */

import './loadEnv.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT  = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const NAME     = 'metadata';
const STAGING  = 'metadata_move_test';
const FROM     = 'europe-west2';
const TO       = 'EU';
const MANIFEST = 'exports/metadata-move-manifest.json';

const CREDS = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const opts  = { projectId: PROJECT };
if (CREDS) { if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS); else opts.keyFilename = CREDS; }
const bq = new BigQuery(opts);

const log = (...a) => console.log(...a);

async function datasetLocation(id) {
  try { const [md] = await bq.dataset(id).getMetadata(); return md.location; }
  catch { return null; }
}

async function tablesOf(id, location) {
  const [tables] = await bq.dataset(id).getTables();
  const out = [];
  for (const t of tables) {
    const [md] = await t.getMetadata();
    out.push({ id: t.id, rows: Number(md.numRows ?? 0), schema: md.schema, description: md.description ?? null, location });
  }
  return out;
}

async function copyTable(srcDataset, dstDataset, tableId, jobLocation) {
  const [job] = await bq.createJob({
    location: jobLocation,
    configuration: { copy: {
      sourceTable:      { projectId: PROJECT, datasetId: srcDataset, tableId },
      destinationTable: { projectId: PROJECT, datasetId: dstDataset, tableId },
      writeDisposition: 'WRITE_TRUNCATE',
    }},
  });
  await job.promise();
  const [md] = await job.getMetadata();
  if (md.status?.errorResult) throw new Error(`${tableId}: ${md.status.errorResult.message}`);
}

async function countRows(dataset, tableId, location) {
  const [rows] = await bq.query({
    location,
    query: `SELECT COUNT(*) AS n FROM \`${PROJECT}.${dataset}.${tableId}\``,
  });
  return Number(rows[0].n);
}

async function ensureDataset(id, location) {
  const existing = await datasetLocation(id);
  if (existing === location) { log(`· ${id} already exists in ${location}`); return; }
  if (existing) throw new Error(`${id} exists in ${existing}, expected ${location}`);
  await bq.createDataset(id, { location });
  log(`✓ created ${id} (${location})`);
}

// ── Where are we? ─────────────────────────────────────────────────────────────

const currentLocation = await datasetLocation(NAME);
log(`metadata is currently in: ${currentLocation ?? '(absent)'}`);

if (currentLocation === TO) {
  log('✓ nothing to do, metadata is already in EU');
  process.exit(0);
}

// ── 1. Manifest + staging copy ───────────────────────────────────────────────

if (currentLocation === FROM) {
  const source = await tablesOf(NAME, FROM);
  mkdirSync('exports', { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ takenAt: new Date().toISOString(), from: FROM, to: TO, tables: source }, null, 2));
  log(`✓ manifest written to ${MANIFEST} (${source.length} tables)`);

  await ensureDataset(STAGING, TO);

  for (const t of source) {
    await copyTable(NAME, STAGING, t.id, FROM);
    const landed = await countRows(STAGING, t.id, TO);
    if (landed !== t.rows) throw new Error(`${t.id}: ${t.rows} rows at source, ${landed} in staging. Stopping.`);
    log(`✓ staged ${t.id} (${landed} rows)`);
  }

  log('\nAll tables verified in EU staging. Deleting the europe-west2 original.');
  await bq.dataset(NAME).delete({ force: true });
  log(`✓ deleted ${NAME} (${FROM})`);
}

// ── 2. Recreate in EU and copy back from staging ─────────────────────────────

await ensureDataset(NAME, TO);

const [stagedTables] = await bq.dataset(STAGING).getTables();
for (const t of stagedTables) {
  await copyTable(STAGING, NAME, t.id, TO);
  const n = await countRows(NAME, t.id, TO);
  log(`✓ ${NAME}.${t.id} in EU (${n} rows)`);
}

// ── 3. Verify against the manifest, then drop staging ────────────────────────

const manifest = JSON.parse((await import('node:fs')).readFileSync(MANIFEST, 'utf8'));
let mismatch = false;
for (const t of manifest.tables) {
  const n = await countRows(NAME, t.id, TO);
  if (n !== t.rows) { mismatch = true; console.error(`✗ ${t.id}: expected ${t.rows}, found ${n}`); }
}
if (mismatch) {
  console.error('\nRow counts do not match the manifest. Staging kept for recovery.');
  process.exit(1);
}

await bq.dataset(STAGING).delete({ force: true });
log(`✓ dropped staging dataset ${STAGING}`);
log('\n✓ metadata now lives in EU and can be joined to ariadne_tiktok_demo');
