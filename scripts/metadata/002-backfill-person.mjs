#!/usr/bin/env node
/**
 * scripts/metadata/002-backfill-person.mjs
 * ----------------------------------------
 * Builds the metadata.person rows from the accounts you already track, and the
 * link back onto tiktok.account.
 *
 * DRY RUN BY DEFAULT. It writes two CSVs to exports/ and changes nothing.
 * Pass --apply to actually write to BigQuery.
 *
 * Where each field comes from:
 *   person_id          deterministic hash of the source account id, so re-runs
 *                      produce the same ids and never duplicate a person
 *   slug               from the name; on collision, the handle disambiguates
 *   name               COALESCE(displayName, name)
 *   display_job_title  displayJobTitle, else the affiliation string when it is
 *                      a real role ('MP, Ipswich') rather than a wing label
 *                      ('left', 'right', 'center')
 *   party              account.party, with 'Not Sure' treated as unknown
 *   location           dashboard 2 accounts: country, ISO code and region from
 *                      data/leaderRegions.ts, continent from world-countries
 *                      dashboard 1 accounts: United Kingdom, plus the
 *                      constituency parsed out of the affiliation string
 *
 * Run: npm run meta:backfill            (dry run)
 *      npm run meta:backfill -- --apply (writes)
 */

import './loadEnv.mjs';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Country, region and coordinates for the World Leaders accounts. A plain data
 * seed rather than a TS module, so nothing about this lives in the app bundle.
 * The warehouse is the source of truth once this has run; the seed only exists
 * so the table can be rebuilt from nothing.
 */
const LEADER_LOCATIONS = JSON.parse(readFileSync(new URL('./seed/leader-locations.json', import.meta.url), 'utf8'));

const APPLY      = process.argv.includes('--apply');
const PROJECT    = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const TIKTOK     = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const METADATA   = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';
const OUT_ROWS   = 'exports/metadata-person-dryrun.csv';
const OUT_REVIEW = 'exports/metadata-person-review.csv';

const CREDS = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const opts  = { projectId: PROJECT };
if (CREDS) { if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS); else opts.keyFilename = CREDS; }
const bq = new BigQuery(opts);

/**
 * `affiliation` never holds a role. On BOTH dashboards it is a political wing
 * label: left, right, centre, none. The job title lives in displayJobTitle,
 * and the constituency is inside it ('MP for Bristol North West').
 */
const WING_VALUES = new Set(['left', 'right', 'center', 'centre', 'center-left', 'centre-left', 'center-right', 'centre-right', 'none']);
const UNKNOWN_PARTY = new Set(['not sure', 'other', '']);

/** SQL string literal, or NULL for an empty value. */
const lit = v => (v === '' || v === null || v === undefined) ? 'NULL' : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const slugify = s => String(s ?? '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Deterministic id from the source account, so re-running never duplicates. */
const personId = accountId => {
  const h = createHash('sha256').update(`person:${accountId}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
};

// ── Read what we have ─────────────────────────────────────────────────────────

const [accounts] = await bq.query({ location: 'EU', query: `
  SELECT
    CAST(a.id AS STRING)            AS account_id,
    LTRIM(LOWER(a.profile), '@')    AS handle,
    COALESCE(a.displayName, a.name) AS name,
    a.displayJobTitle,
    a.affiliation,
    a.party,
    a.avatar,
    a.isActive,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT t.name IGNORE NULLS ORDER BY t.name), '|') AS types,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT CAST(d.dashboardId AS STRING) IGNORE NULLS ORDER BY CAST(d.dashboardId AS STRING)), '|') AS dashboards
  FROM \`${PROJECT}.${TIKTOK}.account\` a
  LEFT JOIN \`${PROJECT}.${TIKTOK}.account_x_accountType\` xt ON CAST(xt.accountId AS STRING) = CAST(a.id AS STRING)
  LEFT JOIN \`${PROJECT}.${TIKTOK}.accountType\` t ON xt.accountTypeId = t.id
  LEFT JOIN \`${PROJECT}.${TIKTOK}.account_x_dashboard\` d ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
  GROUP BY account_id, handle, name, a.displayJobTitle, a.affiliation, a.party, a.avatar, a.isActive
  ORDER BY handle` });

// ── Build the rows ────────────────────────────────────────────────────────────

/**
 * Slugs already taken by people created by hand on /admin/links. They are not
 * in this batch, so without this the backfill could hand their slug to someone
 * else and break the uniqueness the checks rely on.
 */
const [existing] = await bq.query({ location: 'EU', query: `
  SELECT slug FROM \`${PROJECT}.${METADATA}.person\`
  WHERE source_platform IS NOT NULL AND source_platform != 'tiktok'` });

const usedSlugs = new Set(existing.map(r => r.slug));
if (usedSlugs.size) console.log(`  ${usedSlugs.size} slug(s) reserved by hand-created people`);
const rows      = [];
const review    = [];

const jobTitleFor = a => (a.displayJobTitle ?? '').trim();

/** 'MP for Bristol North West' -> 'Bristol North West'. */
const constituencyFor = a => {
  const title = (a.displayJobTitle ?? '').trim();
  const m = /^(?:MP|MSP|MS|AM|Member of the Senedd|Councillor|Cllr)\s+for\s+(.+)$/i.exec(title);
  return m ? m[1].trim() : '';
};

/** left / right / centre / none, as maintained on the account today. */
const wingFor = a => {
  const w = (a.affiliation ?? '').trim().toLowerCase();
  return WING_VALUES.has(w) ? w.replace('center', 'centre') : '';
};

for (const a of accounts) {
  const dashboards = (a.dashboards ?? '').split('|').filter(Boolean);
  const world      = LEADER_LOCATIONS[a.handle] ?? null;

  let location = { country_iso2: '', country: '', continent: '', region: '', constituency: '', latitude: null, longitude: null };
  if (world) {
    location = { ...world, constituency: '' };
  } else if (dashboards.includes('1')) {
    location = {
      country_iso2: 'GB',
      country:      'United Kingdom',
      continent:    'Europe',
      region:       'europe',
      constituency: constituencyFor(a),
      // London, so a UK account still plots if a map ever wants it.
      latitude:     54,
      longitude:    -2,
    };
  }

  let slug = slugify(a.name) || slugify(a.handle);
  if (usedSlugs.has(slug)) slug = `${slug}-${slugify(a.handle)}`;
  usedSlugs.add(slug);

  const party = UNKNOWN_PARTY.has((a.party ?? '').trim().toLowerCase()) ? '' : (a.party ?? '').trim();

  const row = {
    person_id:         personId(a.account_id),
    slug,
    name:              a.name ?? a.handle,
    display_job_title: jobTitleFor(a),
    party,
    wing:              wingFor(a),
    avatar_path:       a.avatar ?? '',
    country_iso2:      location.country_iso2,
    country:           location.country,
    continent:         location.continent,
    region:            location.region,
    constituency:      location.constituency,
    latitude:          location.latitude ?? '',
    longitude:         location.longitude ?? '',
    is_active:         a.isActive === false ? 'false' : 'true',
    source_account_id: a.account_id,
    handle:            a.handle,
    types:             a.types ?? '',
    dashboards:        dashboards.join('|'),
  };
  rows.push(row);

  const reasons = [];
  if (!location.country)                       reasons.push('no location');
  if (!row.display_job_title)                  reasons.push('no job title');
  if (!row.party)                              reasons.push('no party');
  if (!row.types)                              reasons.push('no account type');
  if ((row.types ?? '').includes('political_party')) reasons.push('is an organisation, not a person');
  if (!dashboards.length)                      reasons.push('on no dashboard');
  if (reasons.length) review.push({ ...row, review_reasons: reasons.join('; ') });
}

// ── Write the dry run ─────────────────────────────────────────────────────────

const csv = list => {
  if (!list.length) return '';
  const cols = Object.keys(list[0]);
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...list.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
};

mkdirSync('exports', { recursive: true });
writeFileSync(OUT_ROWS, csv(rows));
writeFileSync(OUT_REVIEW, csv(review));

const byDashboard = d => rows.filter(r => r.dashboards.split('|').includes(d)).length;
console.log(`
Dry run complete. Nothing was written to BigQuery.

  ${rows.length} person rows proposed, one per tracked account
    ${byDashboard('1')} on The Knox Index
    ${byDashboard('2')} on World Leaders
    ${rows.filter(r => !r.dashboards).length} on no dashboard

  ${rows.filter(r => r.country).length} have a country, ${rows.filter(r => !r.country).length} do not
  ${rows.filter(r => r.latitude !== '').length} have coordinates for the globe
  ${rows.filter(r => r.constituency).length} have a constituency parsed from the affiliation string
  ${rows.filter(r => r.display_job_title).length} have a job title
  ${rows.filter(r => r.party).length} have a party
  ${rows.filter(r => r.wing).length} have a wing (left / right / centre / none)
  ${new Set(rows.map(r => r.slug)).size} distinct slugs (must equal ${rows.length})

  all rows      -> ${OUT_ROWS}
  needs a look  -> ${OUT_REVIEW}  (${review.length} rows)
`);

// ── Apply ─────────────────────────────────────────────────────────────────────

if (!APPLY) {
  console.log('Re-run with --apply to write. Nothing has changed.\n');
  process.exit(0);
}

// MERGE on person_id, which is derived from the source account, so a re-run
// updates the same rows rather than inserting duplicates.
const values = rows.map(r => `(
  '${r.person_id}', '${r.slug.replace(/'/g, "\\'")}', ${lit(r.name)}, ${lit(r.display_job_title)},
  ${lit(r.party)}, ${lit(r.wing)}, ${lit(r.avatar_path)},
  STRUCT(${lit(r.country_iso2)} AS country_iso2, ${lit(r.country)} AS country, ${lit(r.continent)} AS continent,
         ${lit(r.region)} AS region, ${lit(r.constituency)} AS constituency,
         ${r.latitude === '' ? 'CAST(NULL AS FLOAT64)' : r.latitude} AS latitude,
         ${r.longitude === '' ? 'CAST(NULL AS FLOAT64)' : r.longitude} AS longitude),
  ${r.is_active === 'true'}, '${r.source_account_id}'
)`).join(',\n');

await bq.query({ location: 'EU', query: `
MERGE \`${PROJECT}.${METADATA}.person\` T
USING (
  SELECT * FROM UNNEST([
    STRUCT<person_id STRING, slug STRING, name STRING, display_job_title STRING,
           party STRING, wing STRING, avatar_path STRING,
           location STRUCT<country_iso2 STRING, country STRING, continent STRING, region STRING, constituency STRING, latitude FLOAT64, longitude FLOAT64>,
           is_active BOOL, source_account_id STRING>
    ${values}
  ])
) S
ON T.person_id = S.person_id
WHEN MATCHED THEN UPDATE SET
  slug = S.slug, name = S.name, display_job_title = S.display_job_title,
  party = S.party, wing = S.wing, avatar_path = S.avatar_path,
  location = S.location, is_active = S.is_active, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (person_id, slug, name, display_job_title, party, wing, avatar_path, location, is_active, source_account_id, source_platform, created_at, updated_at)
VALUES (S.person_id, S.slug, S.name, S.display_job_title, S.party, S.wing, S.avatar_path, S.location, S.is_active, S.source_account_id, 'tiktok', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())` });
console.log(`✓ wrote ${rows.length} rows to ${METADATA}.person`);

// Link each account to the person built from it. Exact by construction: every
// person row carries the account it came from, so this is a key join and not a
// name match. Reads from the table we just wrote rather than a long literal.
const [linkJob] = await bq.createQueryJob({ location: 'EU', query: `
UPDATE \`${PROJECT}.${TIKTOK}.account\` a
SET person_id = p.person_id, linked_at = CURRENT_TIMESTAMP(), linked_by = 'backfill'
FROM \`${PROJECT}.${METADATA}.person\` p
WHERE p.source_account_id = CAST(a.id AS STRING)
  AND (a.person_id IS NULL OR a.person_id != p.person_id)` });
await linkJob.promise();
const [linkMeta] = await linkJob.getMetadata();
console.log(`✓ linked ${linkMeta.statistics?.query?.numDmlAffectedRows ?? '?'} accounts to their person`);
console.log('\nNow run: npm run check:metadata\n');
