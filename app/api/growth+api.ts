/**
 * app/api/growth+api.ts
 * ----------------------
 * Fastest-growing accounts: follower growth over the selected period, per
 * person on the dashboard, TikTok and X added together.
 *
 * GET /api/growth?range=yesterday|week|month|year|lifetime&platform=all|tiktok|x
 *   → { growth: GrowthRow[] }   largest % growth first
 *
 * Followers come from the account snapshots: TikTok's daily accountMetrics,
 * X's accountMetrics (every few days). Start = the latest snapshot within a
 * few days before the period's first day, end = the latest snapshot. Accounts below
 * MIN_START_FOLLOWERS are left out, so a 40-follower account doubling does
 * not top the list.
 */

import { accountWeb, query, tableRef } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { parseRange, type Range } from '@/lib/bqQueries';
import { safeErrorDetail } from '@/lib/errors';
import { buildXFollowerGrowthSQL } from '@/lib/xQueries';
import { parsePlatformFilter } from '@/lib/platforms';

interface SnapshotRow {
  platform:       'tiktok' | 'x';
  accountId:      string;
  personId:       string | null;
  startFollowers: number;
  endFollowers:   number;
  startDate:      string;
  endDate:        string;
}

export interface GrowthRow {
  /** person_id, or 'tiktok:<id>' / 'x:<id>' for an account with no person. */
  key:            string;
  personId:       string | null;
  /** Account ids, so the client can match a single-platform leaderboard. */
  accountIds:     string[];
  platforms:      ('tiktok' | 'x')[];
  startFollowers: number;
  endFollowers:   number;
  gain:           number;
  /** gain / startFollowers, 0..n. */
  pct:            number;
  /** Earliest start snapshot used, for the "since" note. */
  since:          string;
}

const MIN_START_FOLLOWERS = 1000;
const LIMIT = 20;

/**
 * Which snapshots count as the start of the period, and whether to take the
 * earliest. The start must fall within a few days of the period's first day
 * (X snapshots are not daily); an account with none there is left out rather
 * than measured over a longer, unlabelled stretch.
 */
function startOf(range: Range): { filter: string; fromEarliest: boolean } {
  const near = (day: string, slackDays: number) =>
    `dateUpdated BETWEEN DATE_SUB(${day}, INTERVAL ${slackDays} DAY) AND ${day}`;
  switch (range) {
    case 'yesterday': return { filter: near('DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)', 0), fromEarliest: false };
    case 'week':      return { filter: near('DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)', 2), fromEarliest: false };
    case 'month':     return { filter: near('DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)', 4), fromEarliest: false };
    // Snapshots do not reach back to 1 January: use the earliest this year
    case 'year':      return { filter: 'dateUpdated >= DATE_TRUNC(CURRENT_DATE(), YEAR)', fromEarliest: true };
    case 'lifetime':  return { filter: 'TRUE', fromEarliest: true };
  }
}

const TIKTOK_GROWTH_SQL = (dashboardId: number, startFilter: string, fromEarliest: boolean) => `
  WITH acc AS (SELECT a.id, a.person_id FROM ${accountWeb(dashboardId)} a),
  m AS (
    SELECT pageId, dateUpdated, totalFollowers FROM ${tableRef('accountMetrics')}
    WHERE totalFollowers IS NOT NULL AND pageId IN (SELECT id FROM acc)
  ),
  ends AS (
    SELECT pageId, ARRAY_AGG(STRUCT(dateUpdated AS d, totalFollowers AS f) ORDER BY dateUpdated DESC LIMIT 1)[OFFSET(0)] AS e
    FROM m GROUP BY pageId
  ),
  starts AS (
    SELECT pageId, ARRAY_AGG(STRUCT(dateUpdated AS d, totalFollowers AS f) ORDER BY dateUpdated ${fromEarliest ? 'ASC' : 'DESC'} LIMIT 1)[OFFSET(0)] AS s
    FROM m WHERE ${startFilter} GROUP BY pageId
  )
  SELECT 'tiktok' AS platform, CAST(acc.id AS STRING) AS accountId, acc.person_id AS personId,
    s.s.f AS startFollowers, e.e.f AS endFollowers,
    CAST(s.s.d AS STRING) AS startDate, CAST(e.e.d AS STRING) AS endDate
  FROM acc
  JOIN ends e ON e.pageId = acc.id
  JOIN starts s ON s.pageId = acc.id
`;

/** One row per person: their accounts' followers added together. */
function mergeByPerson(rows: SnapshotRow[]): GrowthRow[] {
  const byKey = new Map<string, GrowthRow>();
  for (const r of rows) {
    // The same snapshot at both ends says nothing about growth
    if (r.startDate === r.endDate) continue;
    const key = r.personId ?? `${r.platform}:${r.accountId}`;
    const g = byKey.get(key) ?? {
      key, personId: r.personId, accountIds: [], platforms: [],
      startFollowers: 0, endFollowers: 0, gain: 0, pct: 0, since: r.startDate,
    };
    g.accountIds.push(r.accountId);
    if (!g.platforms.includes(r.platform)) g.platforms.push(r.platform);
    g.startFollowers += Number(r.startFollowers);
    g.endFollowers   += Number(r.endFollowers);
    if (r.startDate < g.since) g.since = r.startDate;
    byKey.set(key, g);
  }
  return [...byKey.values()]
    .map(g => ({ ...g, gain: g.endFollowers - g.startFollowers, pct: g.startFollowers > 0 ? (g.endFollowers - g.startFollowers) / g.startFollowers : 0 }))
    .filter(g => g.startFollowers >= MIN_START_FOLLOWERS)
    .sort((a, b) => b.pct - a.pct || b.gain - a.gain);
}

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get('range'), 'week');
  const platform = parsePlatformFilter(params.get('platform') ?? 'tiktok');
  const xEnabled = (tenant.platforms ?? []).includes('x');
  const wantTikTok = platform !== 'x';
  const wantX = platform !== 'tiktok' && xEnabled;
  const { filter, fromEarliest } = startOf(range);

  try {
    const [tiktok, x] = await Promise.all([
      wantTikTok ? query<SnapshotRow>(TIKTOK_GROWTH_SQL(tenant.dashboardId, filter, fromEarliest)) : [],
      wantX      ? query<SnapshotRow>(buildXFollowerGrowthSQL(tenant.dashboardId, filter, fromEarliest)) : [],
    ]);
    return Response.json(
      { growth: mergeByPerson([...tiktok, ...x]).slice(0, LIMIT) },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/growth] BigQuery error:', logMessage);
    return Response.json({ error: 'Failed to fetch growth', detail: clientDetail }, { status: 500 });
  }
}
