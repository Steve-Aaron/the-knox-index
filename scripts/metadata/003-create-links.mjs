#!/usr/bin/env node
/**
 * scripts/metadata/003-create-links.mjs
 * -------------------------------------
 * Creates the two tables and one view that tie a person to their accounts on
 * each platform, and give the app a single photo per person.
 *
 *   metadata.account_link   one row per (platform, account) -> person, with a
 *                           status a human sets: proposed / confirmed / rejected
 *   metadata.x_account      a small mirror of twitter.account, refreshed by
 *                           004. It exists only because the twitter dataset
 *                           lives in europe-west2 and metadata lives in EU, and
 *                           BigQuery cannot join across locations. Mirroring
 *                           728 rows is cheaper and safer than moving 300 MB of
 *                           tweets into another region.
 *   metadata.person_photo   the view the app reads: one photo per person,
 *                           COALESCEd across the channels in priority order.
 *
 * Nothing in the tiktok or twitter datasets is created, altered or dropped
 * here. Writing the link back onto twitter.account is 005, and is additive.
 *
 * Run: npm run meta:links:create
 */

import { bq, query, metadata, tiktok, PROJECT_ID, METADATA_SET, LOCATION } from './bqClient.mjs';

const ddl = [
  // ── the review queue ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${metadata('account_link')} (
     link_id             STRING    NOT NULL,   -- sha256(platform:account_id), stable across re-runs
     platform            STRING    NOT NULL,   -- 'tiktok' | 'x'
     platform_account_id STRING    NOT NULL,   -- tiktok.account.id / twitter.account.authorId
     platform_handle     STRING,               -- '@keirstarmer' / 'Keir_Starmer'
     platform_name       STRING,               -- the display name on that platform
     person_id           STRING,               -- metadata.person.person_id, NULL when nothing matched
     status              STRING    NOT NULL,   -- 'proposed' | 'confirmed' | 'rejected'
     confidence          STRING,               -- 'exact' | 'high' | 'medium' | 'low' | 'ambiguous' | 'none'
     score               FLOAT64,              -- 0..1, what the matcher scored the winner
     method              STRING,               -- which rule matched: 'handle' | 'name' | 'name-fuzzy' | 'source'
     matched_on          STRING,               -- the normalised value both sides shared, for the reviewer
     alternatives        STRING,               -- JSON array of runners-up, so a reviewer can pick another
     reviewed_by         STRING,
     reviewed_at         TIMESTAMP,
     proposed_at         TIMESTAMP NOT NULL,
     updated_at          TIMESTAMP NOT NULL
   )
   CLUSTER BY platform, status`,

  // ── the mirror ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${metadata('x_account')} (
     author_id       STRING NOT NULL,
     handle          STRING,
     name            STRING,
     profile_picture STRING,
     banner_picture  STRING,
     description     STRING,
     followers       INT64,
     synced_at       TIMESTAMP NOT NULL
   )`,
];

// ── the one photo per person ─────────────────────────────────────────────────
// TikTok first because those avatars are already in our own bucket and signed
// by the API; X is the fallback for anyone we do not track on TikTok.
const photoView = `
CREATE OR REPLACE VIEW ${metadata('person_photo')} AS
SELECT
  p.person_id,
  COALESCE(NULLIF(tk.avatar, ''), NULLIF(x.profile_picture, ''))    AS photo_url,
  CASE
    WHEN NULLIF(tk.avatar, '')          IS NOT NULL THEN 'tiktok'
    WHEN NULLIF(x.profile_picture, '')  IS NOT NULL THEN 'x'
  END                                                               AS photo_source,
  NULLIF(tk.avatar, '')                                             AS tiktok_photo,
  NULLIF(x.profile_picture, '')                                     AS x_photo
FROM ${metadata('person')} p
LEFT JOIN ${metadata('account_link')} ltk
       ON ltk.person_id = p.person_id AND ltk.platform = 'tiktok' AND ltk.status = 'confirmed'
LEFT JOIN ${tiktok('account')} tk
       ON CAST(tk.id AS STRING) = ltk.platform_account_id
LEFT JOIN ${metadata('account_link')} lx
       ON lx.person_id = p.person_id AND lx.platform = 'x' AND lx.status = 'confirmed'
LEFT JOIN ${metadata('x_account')} x
       ON x.author_id = lx.platform_account_id`;

const run = async (label, sql) => {
  await query(sql);
  console.log(`  ✓ ${label}`);
};

console.log(`\nCreating link tables in ${PROJECT_ID}.${METADATA_SET} (${LOCATION})\n`);
await run('metadata.account_link', ddl[0]);
await run('metadata.x_account',    ddl[1]);
await run('metadata.person_photo', photoView);
console.log('\nNext: npm run meta:links -- --apply\n');
