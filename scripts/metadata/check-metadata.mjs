#!/usr/bin/env node
/**
 * scripts/metadata/check-metadata.mjs
 * -----------------------------------
 * Validates the person backfill after it has been applied. Read-only.
 *
 * Checks, in order of how much they would hurt:
 *   0. a person's origin is recorded, and the TikTok-origin checks below are
 *      scoped to those people, since one created by hand on /admin/links comes
 *      from an X account and has no row in the TikTok dataset
 *   1. every person row came from a real account
 *   2. no duplicate slugs, and no duplicate person per account
 *   3. every account on a dashboard is linked to a person
 *   4. every World Leaders person has a country
 *   5. names and job titles survived the trip
 *   6. the account tie-ins are internally consistent, and nothing unconfirmed
 *      has leaked into the photo view
 *
 * Run: npm run check:metadata
 */

import './loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT  = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const TIKTOK   = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const METADATA = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';

const CREDS = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const opts  = { projectId: PROJECT };
if (CREDS) { if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS); else opts.keyFilename = CREDS; }
const bq = new BigQuery(opts);

const q = async sql => (await bq.query({ location: 'EU', query: sql }))[0];

let failures = 0;
const ok   = m => console.log(`  ✓ ${m}`);
const fail = m => { failures++; console.error(`  ✗ ${m}`); };
const expect = (actual, expected, label) =>
  actual === expected ? ok(`${label} → ${actual}`) : fail(`${label} → expected ${expected}, got ${actual}`);

console.log('\nPerson backfill');

const [counts] = await q(`
  SELECT
    (SELECT COUNT(*) FROM \`${PROJECT}.${METADATA}.person\`)                                        AS people,
    (SELECT COUNT(DISTINCT slug) FROM \`${PROJECT}.${METADATA}.person\`)                            AS slugs,
    (SELECT COUNT(DISTINCT CONCAT(COALESCE(source_platform, '?'), ':', source_account_id))
       FROM \`${PROJECT}.${METADATA}.person\`)                                                      AS sources,
    (SELECT COUNTIF(source_platform IS NULL) FROM \`${PROJECT}.${METADATA}.person\`)                AS noOrigin,
    (SELECT COUNT(*) FROM \`${PROJECT}.${TIKTOK}.account\`)                                         AS accounts,
    (SELECT COUNTIF(person_id IS NOT NULL) FROM \`${PROJECT}.${TIKTOK}.account\`)                   AS linked`);

expect(Number(counts.slugs),   Number(counts.people),   'every slug is unique');
expect(Number(counts.noOrigin), 0,                      'every person records where they came from');
expect(Number(counts.sources), Number(counts.people),   'every person came from a distinct account');
expect(Number(counts.linked),  Number(counts.accounts), 'every account is linked to a person');

const [orphans] = await q(`
  SELECT COUNT(*) AS n
  FROM \`${PROJECT}.${METADATA}.person\` p
  LEFT JOIN \`${PROJECT}.${TIKTOK}.account\` a ON CAST(a.id AS STRING) = p.source_account_id
  WHERE p.source_platform = 'tiktok' AND a.id IS NULL`);
expect(Number(orphans.n), 0, 'no person points at an account that does not exist');

const [broken] = await q(`
  SELECT COUNT(*) AS n
  FROM \`${PROJECT}.${TIKTOK}.account\` a
  LEFT JOIN \`${PROJECT}.${METADATA}.person\` p ON p.person_id = a.person_id
  WHERE a.person_id IS NOT NULL AND p.person_id IS NULL`);
expect(Number(broken.n), 0, 'no account points at a person that does not exist');

console.log('\nDashboard coverage');

const [dash] = await q(`
  SELECT
    COUNTIF(d.dashboardId = 1 AND a.person_id IS NULL) AS unlinkedUk,
    COUNTIF(d.dashboardId = 2 AND a.person_id IS NULL) AS unlinkedWorld,
    COUNTIF(d.dashboardId = 2 AND (p.location.country IS NULL OR p.location.country = '')) AS worldNoCountry
  FROM \`${PROJECT}.${TIKTOK}.account_x_dashboard\` d
  JOIN \`${PROJECT}.${TIKTOK}.account\` a ON CAST(a.id AS STRING) = CAST(d.accountId AS STRING)
  LEFT JOIN \`${PROJECT}.${METADATA}.person\` p ON p.person_id = a.person_id`);

expect(Number(dash.unlinkedUk),     0, 'every Knox Index account has a person');
expect(Number(dash.unlinkedWorld),  0, 'every World Leaders account has a person');
expect(Number(dash.worldNoCountry), 0, 'every World Leader has a country');

console.log('\nContent survived');

const [content] = await q(`
  SELECT
    COUNTIF(p.name IS NULL OR p.name = '') AS noName,
    COUNTIF(p.name != COALESCE(a.displayName, a.name)) AS nameDrift
  FROM \`${PROJECT}.${METADATA}.person\` p
  JOIN \`${PROJECT}.${TIKTOK}.account\` a ON CAST(a.id AS STRING) = p.source_account_id
  WHERE p.source_platform = 'tiktok'`);

expect(Number(content.noName),    0, 'no person is missing a name');
expect(Number(content.nameDrift), 0, 'every name matches the account it came from');

const [manual] = await q(`
  SELECT
    COUNTIF(source_platform != 'tiktok')                                        AS created_by_hand,
    COUNTIF(source_platform != 'tiktok' AND created_by IS NULL)                 AS noCreator,
    COUNTIF(source_platform != 'tiktok' AND (name IS NULL OR name = ''))        AS noName
  FROM \`${PROJECT}.${METADATA}.person\``);

expect(Number(manual.noCreator), 0, 'every hand-created person records who created them');
expect(Number(manual.noName),    0, 'every hand-created person has a name');
ok(`people created by hand on /admin/links → ${manual.created_by_hand}`);

console.log('\nAccount tie-ins');

const [links] = await q(`
  SELECT
    COUNT(*)                                                              AS total,
    COUNT(DISTINCT CONCAT(platform, ':', platform_account_id))            AS distinctAccounts,
    COUNTIF(status = 'confirmed' AND person_id IS NULL)                   AS confirmedWithNoPerson,
    COUNTIF(status NOT IN ('proposed', 'confirmed', 'rejected'))          AS badStatus,
    COUNTIF(status = 'confirmed' AND reviewed_by IS NULL)                 AS confirmedWithNoReviewer
  FROM \`${PROJECT}.${METADATA}.account_link\``);

expect(Number(links.distinctAccounts), Number(links.total), 'one link row per platform account');
expect(Number(links.confirmedWithNoPerson),   0, 'no confirmed link points at nobody');
expect(Number(links.badStatus),               0, 'every status is one we recognise');
expect(Number(links.confirmedWithNoReviewer), 0, 'every confirmed link records who confirmed it');

// A person may hold at most one confirmed account per platform: two would make
// the photo view fan out and silently duplicate the person.
const [dupes] = await q(`
  SELECT COUNTIF(n > 1) AS doubled FROM (
    SELECT person_id, platform, COUNT(*) AS n
    FROM \`${PROJECT}.${METADATA}.account_link\`
    WHERE status = 'confirmed' AND person_id IS NOT NULL
    GROUP BY 1, 2)`);
expect(Number(dupes.doubled), 0, 'no person holds two confirmed accounts on one platform');

const [photos] = await q(`
  SELECT
    COUNT(*)                                   AS people,
    COUNTIF(photo_url IS NULL)                 AS noPhoto,
    COUNTIF(photo_source NOT IN ('tiktok','x') AND photo_url IS NOT NULL) AS badSource
  FROM \`${PROJECT}.${METADATA}.person_photo\``);

expect(Number(photos.noPhoto),   0, 'every person resolves to a photo');
expect(Number(photos.badSource), 0, 'every photo names the channel it came from');

console.log(failures === 0 ? '\n✓ Metadata checks passed\n' : `\n✗ ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
