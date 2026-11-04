/**
 * app/api/leagues+api.ts
 * -----------------------
 * Whole-range aggregates for the Style League and Topic Cloud.
 *
 * GET /api/leagues?range=yesterday|week|month|year|lifetime
 *   → { styles: { label, count }[], topics: { label, count }[] }
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
import { parseRange, rangeDateFilter } from '@/lib/bqQueries';
import { safeErrorDetail } from '@/lib/errors';
import { buildXTopicsSQL } from '@/lib/xQueries';
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

// Parent topics on the final list: old TikTok topics go through the map, and
// a subtopic counts towards its parent, so TikTok and X add up by name.
const TOPICS_SQL = (dashboardId: number, dateFilter: string) => `
  SELECT COALESCE(par.name, nt.name) AS label, COUNT(DISTINCT p.postId) AS count
  FROM ${postWeb(dashboardId)} p
  JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  JOIN ${metadataRef('tiktok_topic_map')} m ON m.old_topic_id = pt.topicId
  JOIN ${metadataRef('topic')} nt ON nt.id = m.topic_id
  LEFT JOIN ${metadataRef('topic')} par ON par.id = nt.parent_topic
  WHERE p.videoSummary IS NOT NULL
    AND ${dateFilter}
  GROUP BY label
  ORDER BY count DESC
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
    const [styleRows, tiktokTopicRows, xTopicRows] = await Promise.all([
      wantTikTok ? query<TagRow>(STYLES_SQL(dashboardId, dateFilter)) : [],
      wantTikTok ? query<TagRow>(TOPICS_SQL(dashboardId, dateFilter)) : [],
      wantX      ? query<TagRow>(buildXTopicsSQL(dashboardId, range)) : [],
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
      { styles: clean(styleRows), topics: clean(topicRows) },
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
