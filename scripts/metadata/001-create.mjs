#!/usr/bin/env node
/**
 * scripts/metadata/001-create.mjs
 * -------------------------------
 * Step 1 of the person pivot. Creates the metadata dataset and the person
 * table, then adds the link columns to the TikTok account table.
 *
 * ADDITIVE ONLY. Nothing is dropped, renamed or rewritten:
 *   - `metadata.person` is new, so it cannot disturb anything
 *   - `account` gains three nullable columns, so every existing insert and
 *     every existing query behaves exactly as it does today
 *
 * Idempotent. Run it as many times as you like.
 *
 * Run: npm run meta:create
 */

import './loadEnv.mjs';
import { bq, query, metadata, tiktok, PROJECT_ID, METADATA_SET, LOCATION } from './bqClient.mjs';

// ── 1. The dataset ────────────────────────────────────────────────────────────

const [datasets] = await bq.getDatasets();
if (datasets.some(d => d.id === METADATA_SET)) {
  console.log(`· dataset ${METADATA_SET} already exists`);
} else {
  await bq.createDataset(METADATA_SET, { location: LOCATION });
  console.log(`✓ created dataset ${PROJECT_ID}.${METADATA_SET} (${LOCATION})`);
}

// ── 2. metadata.person ────────────────────────────────────────────────────────
//
// Holds anyone or anything an account belongs to: people, and the party and
// council accounts that are not people. What kind of thing a row is comes from
// the existing accountType taxonomy on the account, so it is not repeated here.
//
// `location` is a STRUCT rather than JSON: same dot access, but typed, cheaper
// to scan, visible in the schema, and BigQuery will let us add nested fields
// later if a dashboard needs one.

await query(`
CREATE TABLE IF NOT EXISTS ${metadata('person')} (
  person_id         STRING  NOT NULL OPTIONS(description="Surrogate key. Generated once from the source account, never displayed, never changes"),
  slug              STRING  NOT NULL OPTIONS(description="URL key, e.g. 'keir-starmer'. Unique across the table"),
  name              STRING  NOT NULL OPTIONS(description="Display name. NOT a key: two accounts already share the name 'Darren Jones'"),
  display_job_title STRING           OPTIONS(description="Job title shown on the front end. Empty for party and council accounts"),
  party             STRING           OPTIONS(description="Party name, e.g. 'labour' or 'MORENA'"),
  wing              STRING           OPTIONS(description="Political wing as maintained on the account today: left, right, centre, none"),
  avatar_path       STRING           OPTIONS(description="GCS object path for the photo, signed at read time"),
  location STRUCT<
    country_iso2  STRING,
    country       STRING,
    continent     STRING,
    region        STRING,
    constituency  STRING,
    latitude      FLOAT64,
    longitude     FLOAT64
  > OPTIONS(description="country_iso2 is the atom: country, continent and region all derive from it. constituency is national dashboards only"),
  is_active         BOOL             OPTIONS(description="Still in post and still tracked"),
  source_account_id STRING           OPTIONS(description="The account row this was created from during the backfill. Audit only"),
  created_at        TIMESTAMP        OPTIONS(description="When this row was first written"),
  updated_at        TIMESTAMP        OPTIONS(description="Last edit")
)
OPTIONS(description="People and organisations behind the tracked accounts. Platform handles live on the platform tables, never here")`);
// Columns added after the table first shipped. ADD COLUMN IF NOT EXISTS keeps
// this safe to re-run against an existing table.
await query(`ALTER TABLE ${metadata('person')} ADD COLUMN IF NOT EXISTS wing STRING OPTIONS(description="Political wing: left, right, centre, none")`);
console.log(`✓ ${METADATA_SET}.person ready`);

// ── 3. The link columns on the TikTok account ────────────────────────────────
//
// Nullable on purpose. A new account can be ingested before anyone has linked
// it, and `person_id IS NULL` is then the queue of work rather than a failure.

const ALTERS = [
  `person_id STRING OPTIONS(description="metadata.person.person_id this account belongs to. NULL means not yet linked")`,
  `linked_at TIMESTAMP OPTIONS(description="When the link was made")`,
  `linked_by STRING OPTIONS(description="Who or what made the link, e.g. 'backfill' or an admin email")`,
].map(col => `ALTER TABLE ${tiktok('account')} ADD COLUMN IF NOT EXISTS ${col};`).join('\n');

await query(ALTERS);
console.log('✓ account gained person_id, linked_at, linked_by (nullable, additive)');

// ── 4. Show what we ended up with ────────────────────────────────────────────

const [accountMeta] = await bq.dataset(process.env.BIGQUERY_DATASET ?? 'ariadne_tiktok_demo').table('account').getMetadata();
console.log('\naccount columns now:', accountMeta.schema.fields.map(f => f.name).join(', '));
console.log('\nNothing reads these yet. Next: npm run meta:backfill (dry run by default)');
