#!/usr/bin/env node
/**
 * scripts/snapshot.mjs
 * ---------------------
 * Prints what each dashboard currently holds, in plain English, straight from
 * BigQuery. No dev server, no browser.
 *
 * This is the 'does this look right to you' report: the numbers a person can
 * sanity-check by eye, rather than assertions that only say pass or fail.
 *
 * Read-only. Run: npm run snapshot
 */

import './metadata/loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT  = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const TIKTOK   = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const METADATA = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';

const CREDS = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const opts  = { projectId: PROJECT };
if (CREDS) { if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS); else opts.keyFilename = CREDS; }
const bq = new BigQuery(opts);
const q  = async sql => (await bq.query({ location: 'EU', query: sql }))[0];

const ACCOUNTS = `
  FROM \`${PROJECT}.${TIKTOK}.account\` a
  JOIN \`${PROJECT}.${TIKTOK}.account_x_dashboard\` d
    ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
  LEFT JOIN \`${PROJECT}.${METADATA}.person\` p ON p.person_id = a.person_id`;

const dashboards = await q(`SELECT id, name FROM \`${PROJECT}.${TIKTOK}.dashboard\` ORDER BY id`);

console.log('\n══════════════════════════════════════════════════════════');
console.log(' KNOX INDEX SNAPSHOT');
console.log('══════════════════════════════════════════════════════════');

for (const dash of dashboards) {
  const [totals] = await q(`
    SELECT
      COUNT(*)                                                   AS accounts,
      COUNTIF(a.person_id IS NOT NULL)                           AS linked,
      COUNTIF(p.location.country IS NOT NULL AND p.location.country != '') AS withCountry,
      COUNTIF(p.location.latitude IS NOT NULL)                   AS withCoordinates,
      COUNTIF(p.display_job_title IS NOT NULL AND p.display_job_title != '') AS withJobTitle
    ${ACCOUNTS}
    WHERE d.dashboardId = ${dash.id}`);

  console.log(`\n── ${dash.name}  (dashboard ${dash.id}) ───────────────────────`);
  console.log(`  ${totals.accounts} accounts`);
  console.log(`  ${totals.linked} linked to a person${Number(totals.linked) === Number(totals.accounts) ? '' : '   ← SOME ARE NOT LINKED'}`);
  console.log(`  ${totals.withCountry} have a country, ${totals.withCoordinates} have map coordinates, ${totals.withJobTitle} have a job title`);

  const groups = await q(`
    SELECT COALESCE(NULLIF(p.location.region, ''), 'unknown') AS grp, COUNT(*) AS n
    ${ACCOUNTS} WHERE d.dashboardId = ${dash.id} GROUP BY grp ORDER BY n DESC`);
  console.log(`\n  By region: ${groups.map(g => `${g.grp} ${g.n}`).join(', ')}`);

  const top = await q(`
    SELECT
      COALESCE(p.name, a.name)              AS name,
      COALESCE(p.display_job_title, '—')    AS job,
      COALESCE(p.location.country, '—')     AS country,
      COALESCE(p.party, '—')                AS party,
      a.totalFollowers                      AS followers
    ${ACCOUNTS} WHERE d.dashboardId = ${dash.id}
    ORDER BY a.totalFollowers DESC LIMIT 5`);

  console.log('\n  Biggest five, as the dashboard would show them:');
  for (const t of top) {
    console.log(`    ${String(t.name).padEnd(24)} ${String(t.job).slice(0, 38).padEnd(40)} ${String(t.country).padEnd(18)} ${t.party}`);
  }

  const [activity] = await q(`
    SELECT COUNT(*) AS posts, COUNT(DISTINCT pst.profile) AS posting
    FROM \`${PROJECT}.${TIKTOK}.post\` pst
    WHERE pst.postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND LTRIM(LOWER(pst.profile), '@') IN (
        SELECT LTRIM(LOWER(a.profile), '@') ${ACCOUNTS} WHERE d.dashboardId = ${dash.id})`);
  console.log(`\n  Last 7 days: ${activity.posts} posts from ${activity.posting} accounts`);
}

const [unlinked] = await q(`
  SELECT COUNT(*) AS n FROM \`${PROJECT}.${TIKTOK}.account\` WHERE person_id IS NULL`);
const [people] = await q(`SELECT COUNT(*) AS n FROM \`${PROJECT}.${METADATA}.person\``);

console.log('\n── Across everything ─────────────────────────────────────');
console.log(`  ${people.n} people and organisations in metadata.person`);
console.log(`  ${unlinked.n} accounts not yet linked to one${Number(unlinked.n) ? '   ← worth a look' : ''}`);
const linkRows = await q(`
  SELECT platform, status, COUNT(*) AS n
  FROM \`${PROJECT}.${METADATA}.account_link\`
  GROUP BY 1, 2 ORDER BY 1, 2`);

if (linkRows.length) {
  const say = p => linkRows.filter(r => r.platform === p)
    .map(r => `${r.n} ${r.status}`).join(', ') || 'none';
  console.log(`  TikTok tie-ins: ${say('tiktok')}`);
  console.log(`  X tie-ins:      ${say('x')}`);

  const [photos] = await q(`
    SELECT COUNTIF(photo_source = 'tiktok') AS tk, COUNTIF(photo_source = 'x') AS x,
           COUNTIF(photo_url IS NULL) AS none
    FROM \`${PROJECT}.${METADATA}.person_photo\``);
  console.log(`  Photos:         ${photos.tk} from TikTok, ${photos.x} from X, ${photos.none} with none`);
}

console.log('');
