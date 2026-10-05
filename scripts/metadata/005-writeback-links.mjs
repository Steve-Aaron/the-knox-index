#!/usr/bin/env node
/**
 * scripts/metadata/005-writeback-links.mjs
 * ----------------------------------------
 * Writes CONFIRMED links back onto the platform tables, so a query that starts
 * at twitter.account or tiktok.account can reach the person without going
 * through metadata.account_link first.
 *
 *   twitter.account.person_id   the canonical link (added by this script)
 *   twitter.account.ariadneId   the TikTok account id for the same person,
 *                               which is the column that already existed for
 *                               this purpose and is NULL on every row today
 *   ariadne_tiktok_demo.account.person_id   already written by 002
 *
 * ADDITIVE ONLY. Columns are added with ADD COLUMN IF NOT EXISTS; nothing is
 * dropped, renamed or rewritten, on either dataset. Rows the reviewer has not
 * confirmed are left alone, so this can be re-run after every review session.
 *
 * The two datasets are in different BigQuery locations (metadata in EU,
 * twitter in europe-west2), so the join happens here in Node rather than in
 * SQL. That is also why metadata.x_account exists.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 *
 * Run: npm run meta:writeback              (dry run)
 *      npm run meta:writeback -- --apply   (writes)
 */

import { bq, query, metadata, PROJECT_ID } from './bqClient.mjs';

const APPLY       = process.argv.includes('--apply');
const TWITTER_SET = process.env.BIGQUERY_TWITTER_DATASET  ?? 'twitter';
const TWITTER_LOC = process.env.BIGQUERY_TWITTER_LOCATION ?? 'europe-west2';
const TW_ACCOUNT  = `\`${PROJECT_ID}.${TWITTER_SET}.account\``;

const twQuery = async sql => (await bq.query({ query: sql, location: TWITTER_LOC }))[0];

/**
 * Every confirmed X link, with the TikTok account id for the same person.
 * A person with no confirmed TikTok account still gets person_id; ariadneId
 * stays NULL, because there is no TikTok row for it to point at.
 */
const links = await query(`
  SELECT
    lx.platform_account_id AS author_id,
    lx.person_id,
    ltk.platform_account_id AS tiktok_account_id
  FROM ${metadata('account_link')} lx
  LEFT JOIN ${metadata('account_link')} ltk
         ON ltk.person_id = lx.person_id
        AND ltk.platform  = 'tiktok'
        AND ltk.status    = 'confirmed'
  WHERE lx.platform = 'x'
    AND lx.status   = 'confirmed'
    AND lx.person_id IS NOT NULL`);

const withTikTok = links.filter(l => l.tiktok_account_id);

console.log(`\n${links.length} confirmed X links`);
console.log(`  ${withTikTok.length} also have a confirmed TikTok account, so ariadneId can be set`);
console.log(`  ${links.length - withTikTok.length} will get person_id only`);

if (links.length === 0) {
  console.log('\nNothing confirmed yet. Review some on /admin/links first.\n');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nSample of what would be written:');
  for (const l of links.slice(0, 5)) {
    console.log(`  author ${l.author_id.padEnd(20)} -> person ${l.person_id}  ariadneId ${l.tiktok_account_id ?? '(none)'}`);
  }
  console.log('\nDry run. Nothing was written. Re-run with --apply.\n');
  process.exit(0);
}

/* ───────────────────────── write ───────────────────────── */

// Additive: these do nothing when the columns are already there.
await twQuery(`ALTER TABLE ${TW_ACCOUNT}
  ADD COLUMN IF NOT EXISTS person_id STRING,
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS linked_by STRING`);
console.log('  ✓ link columns present on twitter.account');

const lit = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * One UPDATE per batch, joining against an inline list. The guard on the last
 * line means a re-run with nothing new to say writes no rows at all.
 */
let written = 0;
for (let i = 0; i < links.length; i += 300) {
  const chunk  = links.slice(i, i + 300);
  const values = chunk.map(l =>
    `STRUCT(${lit(l.author_id)} AS author_id, ${lit(l.person_id)} AS person_id, ${l.tiktok_account_id ?? 'NULL'} AS ariadne_id)`,
  ).join(',\n      ');

  const [job] = await bq.createQueryJob({
    location: TWITTER_LOC,
    query: `
      UPDATE ${TW_ACCOUNT} a
      SET person_id = s.person_id,
          ariadneId = COALESCE(s.ariadne_id, a.ariadneId),
          linked_at = CURRENT_TIMESTAMP(),
          linked_by = 'review'
      FROM (SELECT * FROM UNNEST([
      ${values}
      ])) s
      WHERE a.authorId = s.author_id
        AND (a.person_id IS DISTINCT FROM s.person_id
          OR a.ariadneId IS DISTINCT FROM COALESCE(s.ariadne_id, a.ariadneId))`,
  });
  await job.getQueryResults();
  // The row count only appears on the job once it has finished, so metadata is
  // read after the results, not alongside them.
  const [meta] = await job.getMetadata();
  written += Number(
    meta.statistics?.query?.numDmlAffectedRows ??
    meta.statistics?.query?.dmlStats?.updatedRowCount ?? 0,
  );
}

console.log(`  ✓ updated ${written} rows on twitter.account`);

const [check] = await twQuery(`
  SELECT COUNT(*) AS n,
         COUNTIF(person_id IS NOT NULL) AS with_person,
         COUNTIF(ariadneId IS NOT NULL) AS with_ariadne_id
  FROM ${TW_ACCOUNT}`);
console.log(`\n  twitter.account: ${check.n} rows, ${check.with_person} linked to a person, ${check.with_ariadne_id} with ariadneId\n`);
