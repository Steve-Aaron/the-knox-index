#!/usr/bin/env node
/**
 * scripts/metadata/004-link-accounts.mjs
 * --------------------------------------
 * Fills metadata.account_link: which platform account belongs to which person.
 *
 * Three jobs, in order:
 *   1. mirror twitter.account (europe-west2) into metadata.x_account (EU), so
 *      the photo view and the admin page can join to it
 *   2. seed the TikTok links, which are certain: every person was built FROM a
 *      tiktok account, so that link is 'confirmed' with method 'source'
 *   3. propose the X links by matching handle and name, each with a confidence
 *      a human then confirms or rejects on /admin/links
 *
 * DRY RUN BY DEFAULT. Writes exports/account-links-dryrun.csv and changes
 * nothing. Pass --apply to write to BigQuery.
 *
 * Nothing here touches the tiktok or twitter datasets. Both are read only.
 *
 * Run: npm run meta:links              (dry run)
 *      npm run meta:links -- --apply   (writes)
 */

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { bq, query, metadata, tiktok, PROJECT_ID, LOCATION } from './bqClient.mjs';

const APPLY      = process.argv.includes('--apply');
const TWITTER_SET = process.env.BIGQUERY_TWITTER_DATASET ?? 'twitter';
const TWITTER_LOC = process.env.BIGQUERY_TWITTER_LOCATION ?? 'europe-west2';
const OUT         = 'exports/account-links-dryrun.csv';

/* ───────────────────────── normalising ───────────────────────── */

/** Strip diacritics and case so 'Peña' and 'Pena' compare equal. */
const fold = s => String(s ?? '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A handle with the @, dots, underscores and platform noise removed. */
const normHandle = s => fold(s).replace(/^@/, '').replace(/[^a-z0-9]/g, '');

/**
 * Titles and post-nominals that decorate a name on one platform and not the
 * other: 'Keir Starmer MP' and 'Keir Starmer' are the same person.
 */
const TITLES = new Set([
  'rt','hon','right','honourable','sir','dame','dr','doctor','prof','professor',
  'lord','lady','baroness','baron','mr','mrs','ms','miss','mx','rev','reverend',
  'president','pm','minister','senator','councillor','cllr','official','mp','msp',
  'mla','ms','am','mep','ambassador','governor','mayor','the','deputy','former',
]);

/** The comparable form of a name: folded, de-titled, de-punctuated. */
const normName = s => fold(s)
  .replace(/\b(mp|msp|mla|mep|am|ms)\b/g, ' ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter(t => t && !TITLES.has(t)).join(' ').trim();

/** The name as a set of tokens, so word order and middle names do not matter. */
const nameTokens = s => new Set(normName(s).split(' ').filter(Boolean));

const linkId = (platform, accountId) =>
  createHash('sha256').update(`${platform}:${accountId}`).digest('hex').slice(0, 32);

/** Jaccard overlap of two token sets: 1 when identical, 0 when disjoint. */
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / (a.size + b.size - hit);
}

/* ───────────────────────── the matcher ───────────────────────── */

/**
 * Score one X account against one person. Returns null when nothing matches.
 * Rules are ordered strongest first and the first hit wins, so the reason a
 * link exists is always a single, explainable rule.
 */
function scorePair(x, person) {
  if (person.handle && normHandle(x.handle) === normHandle(person.handle)) {
    return { score: 1,    confidence: 'exact',  method: 'handle',     matched_on: normHandle(x.handle) };
  }
  const xn = normName(x.name), pn = normName(person.name);
  if (xn && xn === pn) {
    return { score: 0.92, confidence: 'high',   method: 'name',       matched_on: xn };
  }
  // The X handle spelled out as a name: 'Keir_Starmer' vs 'Keir Starmer'.
  if (pn && normHandle(x.handle) === pn.replace(/\s/g, '')) {
    return { score: 0.9,  confidence: 'high',   method: 'handle-name', matched_on: pn };
  }
  const ov = overlap(nameTokens(x.name), nameTokens(person.name));
  if (ov >= 0.66) {
    return { score: 0.6 + ov * 0.25, confidence: 'medium', method: 'name-fuzzy', matched_on: `${xn} ~ ${pn}` };
  }
  // Surname plus first initial, which catches 'J Smith' against 'John Smith'.
  const xt = normName(x.name).split(' '), pt = pn.split(' ');
  if (xt.length > 1 && pt.length > 1 && xt.at(-1) === pt.at(-1) && xt[0][0] === pt[0][0]) {
    return { score: 0.45, confidence: 'low', method: 'surname-initial', matched_on: xt.at(-1) };
  }
  return null;
}

/* ───────────────────────── read both sides ───────────────────────── */

console.log(`\nReading ${PROJECT_ID}…`);

const people = await query(`
  SELECT p.person_id, p.name, p.slug, p.source_account_id,
         a.profile AS handle, a.displayName AS tiktok_name
  FROM ${metadata('person')} p
  LEFT JOIN ${tiktok('account')} a ON CAST(a.id AS STRING) = p.source_account_id`);

const [xRows] = await bq.query({
  location: TWITTER_LOC,
  query: `
    SELECT authorId AS author_id, author AS handle, name,
           profilePicture AS profile_picture, bannerPicture AS banner_picture,
           description, followersCount AS followers
    FROM \`${PROJECT_ID}.${TWITTER_SET}.account\``,
});

const tiktokAccounts = await query(`
  SELECT CAST(id AS STRING) AS id, profile AS handle,
         COALESCE(displayName, name) AS name
  FROM ${tiktok('account')}`);

console.log(`  ${people.length} people, ${tiktokAccounts.length} TikTok accounts, ${xRows.length} X accounts`);

/* ───────────────────────── build the rows ───────────────────────── */

const now  = 'CURRENT_TIMESTAMP()';
const rows = [];

// 1. TikTok: certain by construction.
const personBySourceId = new Map(people.map(p => [p.source_account_id, p]));
for (const a of tiktokAccounts) {
  const p = personBySourceId.get(a.id);
  rows.push({
    link_id: linkId('tiktok', a.id), platform: 'tiktok',
    platform_account_id: a.id, platform_handle: a.handle, platform_name: a.name,
    person_id: p?.person_id ?? null,
    status: p ? 'confirmed' : 'proposed',
    confidence: p ? 'exact' : 'none',
    score: p ? 1 : 0,
    method: 'source', matched_on: a.id, alternatives: '[]',
    reviewed_by: p ? 'backfill' : null,
  });
}

// 2. X: proposed, for a human to confirm.
let counts = { exact: 0, high: 0, medium: 0, low: 0, ambiguous: 0, none: 0 };
for (const x of xRows) {
  const scored = people
    .map(p => { const s = scorePair(x, p); return s && { ...s, person: p }; })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const tied = best ? scored.filter(s => s.score === best.score) : [];
  const ambiguous = tied.length > 1;

  const confidence = !best ? 'none' : ambiguous ? 'ambiguous' : best.confidence;
  counts[confidence]++;

  rows.push({
    link_id: linkId('x', x.author_id), platform: 'x',
    platform_account_id: x.author_id, platform_handle: x.handle, platform_name: x.name,
    person_id: best && !ambiguous ? best.person.person_id : null,
    status: 'proposed',
    confidence,
    score: best?.score ?? 0,
    method: best?.method ?? null,
    matched_on: best?.matched_on ?? null,
    alternatives: JSON.stringify(
      scored.slice(0, 5).map(s => ({
        person_id: s.person.person_id, name: s.person.name,
        score: Number(s.score.toFixed(3)), method: s.method,
      })),
    ),
    reviewed_by: null,
  });
}

console.log(`\nX matches: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);

/* ───────────────────────── dry run ───────────────────────── */

mkdirSync('exports', { recursive: true });
const cols = ['platform','platform_account_id','platform_handle','platform_name','person_id','status','confidence','score','method','matched_on'];
const csv  = [cols.join(',')].concat(
  rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')),
).join('\n');
writeFileSync(OUT, csv);
console.log(`\n  ${rows.length} link rows -> ${OUT}`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply.\n');
  process.exit(0);
}

/* ───────────────────────── write ───────────────────────── */

/**
 * A SQL string literal. Bios carry newlines, quotes and tabs, and a raw newline
 * ends a single-quoted literal in BigQuery, so every control character is
 * escaped rather than passed through.
 */
const lit = v => (v === null || v === undefined || v === '') ? 'NULL'
  : `'${String(v)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\u0000-\u001f]/g, '')}'`;

// Mirror X accounts into EU. Full replace: it is 728 rows and always current.
await query(`TRUNCATE TABLE ${metadata('x_account')}`);
for (let i = 0; i < xRows.length; i += 400) {
  const chunk = xRows.slice(i, i + 400);
  await query(`INSERT INTO ${metadata('x_account')}
    (author_id, handle, name, profile_picture, banner_picture, description, followers, synced_at)
    VALUES ${chunk.map(x => `(${lit(x.author_id)}, ${lit(x.handle)}, ${lit(x.name)}, ${lit(x.profile_picture)}, ${lit(x.banner_picture)}, ${lit(x.description)}, ${x.followers ?? 'NULL'}, ${now})`).join(',\n')}`);
}
console.log(`  ✓ mirrored ${xRows.length} X accounts into metadata.x_account`);

/**
 * MERGE, not INSERT: re-running must not duplicate, and it must never stamp
 * over a link a human has already confirmed or rejected. Only rows still
 * sitting at 'proposed' get the matcher's new opinion.
 */
for (let i = 0; i < rows.length; i += 300) {
  const chunk = rows.slice(i, i + 300);
  const values = chunk.map(r => `(
    ${lit(r.link_id)}, ${lit(r.platform)}, ${lit(r.platform_account_id)}, ${lit(r.platform_handle)},
    ${lit(r.platform_name)}, ${lit(r.person_id)}, ${lit(r.status)}, ${lit(r.confidence)},
    ${r.score ?? 0}, ${lit(r.method)}, ${lit(r.matched_on)}, ${lit(r.alternatives)}, ${lit(r.reviewed_by)}
  )`).join(',\n');

  await query(`
    MERGE ${metadata('account_link')} T
    USING (
      SELECT * FROM UNNEST([STRUCT<
        link_id STRING, platform STRING, platform_account_id STRING, platform_handle STRING,
        platform_name STRING, person_id STRING, status STRING, confidence STRING,
        score FLOAT64, method STRING, matched_on STRING, alternatives STRING, reviewed_by STRING
      >${values}])
    ) S
    ON T.link_id = S.link_id
    WHEN MATCHED AND T.status = 'proposed' THEN UPDATE SET
      platform_handle = S.platform_handle, platform_name = S.platform_name,
      person_id = S.person_id, status = S.status, confidence = S.confidence,
      score = S.score, method = S.method, matched_on = S.matched_on,
      alternatives = S.alternatives, updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      link_id, platform, platform_account_id, platform_handle, platform_name,
      person_id, status, confidence, score, method, matched_on, alternatives,
      reviewed_by, reviewed_at, proposed_at, updated_at
    ) VALUES (
      S.link_id, S.platform, S.platform_account_id, S.platform_handle, S.platform_name,
      S.person_id, S.status, S.confidence, S.score, S.method, S.matched_on, S.alternatives,
      S.reviewed_by, IF(S.reviewed_by IS NULL, NULL, CURRENT_TIMESTAMP()),
      CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
    )`);
}
console.log(`  ✓ merged ${rows.length} rows into metadata.account_link`);
console.log('\nNow review them: npm run dev, then open /admin/links\n');
