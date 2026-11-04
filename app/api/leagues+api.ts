/**
 * app/api/leagues+api.ts
 * -----------------------
 * Whole-range aggregates for the Style League and Topic Cloud.
 *
 * GET /api/leagues?range=yesterday|week|month|year|lifetime
 *   → { styles: { label, count }[], topics: { label, count }[],
 *       rising: { label, cur, prev, gain, ratio }[] | null }
 *
 * `rising` compares each topic (most specific tag) with the period before;
 * null on lifetime, which has no period before it.
 *
 * Counts every matching post in the selected range via GROUP BY in BigQuery —
 * NOT the paginated feed. This is what lets the Style League / Topic Cloud
 * reflect all posts (e.g. on lifetime) instead of just the first loaded page.
 *
 * Scope: the whole range (matches the feed's universe via videoSummary IS NOT
 * NULL); it intentionally ignores transient feed filters like party/min-views.
 */

import { query, tableRef, metadataRef, postWeb } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { parseRange, prevRangeDateFilter, rangeDateFilter } from '@/lib/bqQueries';
import { safeErrorDetail } from '@/lib/errors';
import { buildXRisingTopicsSQL, buildXTopicsSQL } from '@/lib/xQueries';
import { rankRising, type TopicPeriodCount } from '@/lib/rising';
import { tiktokTopicAliasSql } from '@/lib/topicAliases';
import { parsePlatformFilter } from '@/lib/platforms';

interface TagRow { label: string; count: number }

const STYLES_SQL = (dashboardId: number, dateFilter: string) => `
  SELECT s.name AS label, COUNT(DISTINCT p.postId) AS count
  FROM ${postWeb(dashboardId)} p
  JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE p.videoSummary IS NOT NULL
    AND ${dateFilter}
    AND s.name IS NOT NULL
  GROUP BY s.name
  ORDER BY count DESC
`;

// Parent topics on the final list: old TikTok topics are matched by name or
// by lib/topicAliases.ts, and a subtopic counts towards its parent, so TikTok
// and X add up by name. Old topics that match nothing are left out.
const TOPICS_SQL = (dashboardId: number, dateFilter: string) => `
  SELECT COALESCE(par.name, nt.name) AS label, COUNT(DISTINCT p.postId) AS count
  FROM ${postWeb(dashboardId)} p
  JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  JOIN ${tableRef('topic')} ot ON ot.id = pt.topicId
  LEFT JOIN ${tiktokTopicAliasSql()} al ON al.old_name = UPPER(ot.name)
  JOIN ${metadataRef('topic')} nt ON nt.name = COALESCE(al.new_name, UPPER(ot.name))
  LEFT JOIN ${metadataRef('topic')} par ON par.id = nt.parent_topic
  WHERE p.videoSummary IS NOT NULL
    AND ${dateFilter}
  GROUP BY label
  ORDER BY count DESC
`;

// Posts per topic this period and the one before, at the most specific tag on
// the final list (a subtopic, or the parent when only that is tagged).
const RISING_SQL = (dashboardId: number, cur: string, prev: string) => `
  SELECT nt.name AS label,
    COUNT(DISTINCT IF(${cur}, p.postId, NULL))  AS cur,
    COUNT(DISTINCT IF(${prev}, p.postId, NULL)) AS prev
  FROM ${postWeb(dashboardId)} p
  JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  JOIN ${tableRef('topic')} ot ON ot.id = pt.topicId
  LEFT JOIN ${tiktokTopicAliasSql()} al ON al.old_name = UPPER(ot.name)
  JOIN ${metadataRef('topic')} nt ON nt.name = COALESCE(al.new_name, UPPER(ot.name))
  WHERE p.videoSummary IS NOT NULL
    AND ((${cur}) OR (${prev}))
  GROUP BY label
`;

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;
  const dashboardId = tenant.dashboardId;

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get('range'), 'week');
  // No param = TikTok only, as before X existed. X has topics but no styles.
  const platform = parsePlatformFilter(params.get('platform') ?? 'tiktok');
  const wantTikTok = platform !== 'x';
  const wantX      = platform !== 'tiktok';
  // rangeDateFilter returns an unqualified `postDate` predicate; only the post
  // table carries that column, so it resolves to p.postDate unambiguously.
  const dateFilter = rangeDateFilter(range);

  try {
    const hasPrevious = range !== 'lifetime';
    const prevFilter = prevRangeDateFilter(range);
    const [styleRows, tiktokTopicRows, xTopicRows, tiktokRising, xRising] = await Promise.all([
      wantTikTok ? query<TagRow>(STYLES_SQL(dashboardId, dateFilter)) : [],
      wantTikTok ? query<TagRow>(TOPICS_SQL(dashboardId, dateFilter)) : [],
      wantX      ? query<TagRow>(buildXTopicsSQL(dashboardId, range)) : [],
      wantTikTok && hasPrevious ? query<TopicPeriodCount>(RISING_SQL(dashboardId, dateFilter, prevFilter)) : [],
      wantX      && hasPrevious ? query<TopicPeriodCount>(buildXRisingTopicsSQL(dashboardId, range)) : [],
    ]);

    // Same topic name on both platforms → one row, counts added.
    const topicCounts = new Map<string, number>();
    for (const r of [...tiktokTopicRows, ...xTopicRows]) {
      topicCounts.set(r.label, (topicCounts.get(r.label) ?? 0) + Number(r.count ?? 0));
    }
    const topicRows: TagRow[] = [...topicCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const clean = (rows: TagRow[]) =>
      rows
        .map(r => ({ label: String(r.label ?? '').trim(), count: Number(r.count ?? 0) }))
        .filter(r => r.label.length > 0 && r.count > 0);

    return Response.json(
      {
        styles: clean(styleRows),
        topics: clean(topicRows),
        rising: hasPrevious ? rankRising([...tiktokRising, ...xRising], 8) : null,
      },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/leagues] BigQuery error:', logMessage);
    return Response.json(
      { error: 'Failed to fetch leagues', detail: clientDetail },
      { status: 500 },
    );
  }
}
