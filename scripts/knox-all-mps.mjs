/**
 * scripts/knox-all-mps.mjs
 * One-off: compute Knox Factor for every account flagged as 'member_of_parliament'.
 * Mirrors lib/bqQueries.ts (lifetime range), data/transformers.ts (axis math)
 * and data/knoxConfig.ts (caps + curve). Read-only — no DB writes.
 *
 * Usage:  node scripts/knox-all-mps.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { BigQuery } from '@google-cloud/bigquery';

// ── Load .env.local ──────────────────────────────────────────────────────────
const envFile = path.resolve('.env.local');
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID;
const DATASET    = process.env.BIGQUERY_DATASET;
const CREDS_PATH = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);

const bq = new BigQuery({ projectId: PROJECT_ID, keyFilename: CREDS_PATH });
const tbl = (t) => `\`${PROJECT_ID}.${DATASET}.${t}\``;

// ── Knox Factor config — must match data/knoxConfig.ts ───────────────────────
const CAPS = { virality: 5, engagement: 100, frequency: 150, followers: 50 };
const CURVE = 1.3;
const MIN_SCORE = 5;

function computeKnoxFactor(virality, engagement, followers, frequency) {
  const composite =
    (virality   / 100) * CAPS.virality   +
    (engagement / 100) * CAPS.engagement +
    (followers  / 100) * CAPS.followers  +
    (frequency  / 100) * CAPS.frequency;
  const clamped = Math.min(100, Math.max(0, composite));
  const PIVOT = 50;
  const delta = clamped - PIVOT;
  const normDelta = Math.abs(delta) / PIVOT;
  const compressed = Math.pow(normDelta, CURVE) * PIVOT;
  const curved = PIVOT + Math.sign(delta) * compressed;
  const hasActivity = virality + engagement + followers + frequency > 0;
  const floored = hasActivity ? Math.max(curved, MIN_SCORE) : curved;
  return Math.round(Math.min(100, Math.max(0, floored)));
}

const normalise = (v, max) => max <= 0 ? 0 : Math.round(Math.min(100, (v / max) * 100));

// ── SQL: lifetime range, MPs only ────────────────────────────────────────────
const SQL = `
  SELECT
    a.id, a.name, a.profile, a.party,
    COALESCE(a.totalFollowers, 0) AS totalFollowers,
    COALESCE(m.totalPosts,     0) AS totalPosts,
    COALESCE(m.totalViews,     0) AS totalViews,
    COALESCE(m.totalLikes,     0) AS totalLikes,
    COALESCE(m.totalComments,  0) AS totalComments,
    COALESCE(m.totalShares,    0) AS totalShares,
    COALESCE(m.totalSaves,     0) AS totalSaves,
    COALESCE(pw.postsThisWeek, 0) AS postsThisWeek,
    COALESCE(ra.postsInRange,    0) AS postsInRange,
    COALESCE(ra.viewsInRange,    0) AS viewsInRange,
    COALESCE(ra.likesInRange,    0) AS likesInRange,
    COALESCE(ra.commentsInRange, 0) AS commentsInRange,
    COALESCE(ra.savesInRange,    0) AS savesInRange,
    COALESCE(ra.sharesInRange,   0) AS sharesInRange,
    acct.accountTypeNames
  FROM ${tbl('account')} a
  LEFT JOIN (
    SELECT axat.accountId, STRING_AGG(atype.name, ',' ORDER BY atype.id) AS accountTypeNames
    FROM ${tbl('account_x_accountType')} axat
    JOIN ${tbl('accountType')} atype ON axat.accountTypeId = atype.id
    GROUP BY axat.accountId
  ) acct ON a.id = acct.accountId
  LEFT JOIN (
    SELECT * FROM ${tbl('accountMetrics')}
    WHERE dateUpdated = (SELECT MAX(dateUpdated) FROM ${tbl('accountMetrics')})
  ) m ON a.id = m.pageId
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsThisWeek
    FROM ${tbl('post')}
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pw ON LTRIM(a.profile, '@') = pw.profile
  LEFT JOIN (
    SELECT
      LTRIM(profile, '@')        AS profile,
      COUNT(*)                   AS postsInRange,
      SUM(COALESCE(views, 0))    AS viewsInRange,
      SUM(COALESCE(likes, 0))    AS likesInRange,
      SUM(COALESCE(comments, 0)) AS commentsInRange,
      SUM(COALESCE(saves, 0))    AS savesInRange,
      SUM(COALESCE(shares, 0))   AS sharesInRange
    FROM ${tbl('post')}
    WHERE postDate IS NOT NULL
    GROUP BY LTRIM(profile, '@')
  ) ra ON LTRIM(a.profile, '@') = ra.profile
  WHERE acct.accountTypeNames LIKE '%member_of_parliament%'
`;

// ── Run + compute ───────────────────────────────────────────────────────────
const [rows] = await bq.query({ query: SQL, location: 'EU' });
console.log(`Fetched ${rows.length} MP accounts.\n`);

// Per-account raw axis values (lifetime range)
const raw = rows.map(r => {
  const rangeViews = Number(r.viewsInRange) || 0;
  const postsInR   = Number(r.postsInRange) || 0;
  const avgViews   = rangeViews > 0 && postsInR > 0 ? rangeViews / postsInR : 0;
  const fl         = Number(r.totalFollowers) || 0;
  const viralityRaw = fl > 0 ? avgViews / fl : 0;

  const eViews    = Math.max(rangeViews > 0 ? rangeViews : (Number(r.totalViews) || 1), 1);
  const eLikes    = Number(r.likesInRange ?? r.totalLikes ?? 0);
  const eComments = Number(r.commentsInRange ?? r.totalComments ?? 0);
  const eSaves    = Number(r.savesInRange ?? r.totalSaves ?? 0);
  const eShares   = Number(r.sharesInRange ?? r.totalShares ?? 0);
  const engRate   = ((eLikes + eComments + eSaves + eShares) / eViews) * 100;

  const postsCount = postsInR > 0 ? postsInR : Number(r.postsThisWeek) || 0;

  return {
    name: r.name, party: r.party, profile: r.profile,
    avgViews, viralityRaw, engRate, postsCount, followers: fl,
  };
});

// Dataset maxes
const max = {
  virality:    Math.max(...raw.map(x => x.viralityRaw)) || 1,
  engRate:     Math.max(...raw.map(x => x.engRate))     || 1,
  postsCount:  Math.max(...raw.map(x => x.postsCount))  || 1,
  followers:   Math.max(...raw.map(x => x.followers))   || 1,
};

// Final table
const scored = raw.map(x => {
  const vN = normalise(x.viralityRaw, max.virality);
  const eN = normalise(x.engRate,     max.engRate);
  const fN = normalise(x.postsCount,  max.postsCount);
  const flN = normalise(x.followers,  max.followers);
  const k  = computeKnoxFactor(vN, eN, flN, fN);
  return { ...x, vN, eN, fN, flN, k };
}).sort((a, b) => b.k - a.k);

// Print
console.log(
  ['Rank', 'Knox', 'Vir', 'Eng', 'Frq', 'Flw', 'Party'.padEnd(14), 'Name'].join('\t')
);
console.log('-'.repeat(110));
scored.forEach((x, i) => {
  console.log([
    String(i + 1).padStart(4),
    String(x.k).padStart(4),
    String(x.vN).padStart(3),
    String(x.eN).padStart(3),
    String(x.fN).padStart(3),
    String(x.flN).padStart(3),
    String(x.party || '').slice(0, 14).padEnd(14),
    x.name,
  ].join('\t'));
});

console.log('\nDataset maxes (lifetime):');
console.log(`  virality (avgViews/followers): ${max.virality.toFixed(4)}`);
console.log(`  engagement rate (%):           ${max.engRate.toFixed(2)}`);
console.log(`  posts in range:                ${max.postsCount}`);
console.log(`  followers:                     ${max.followers.toLocaleString()}`);
