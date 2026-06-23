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

import { query, tableRef } from '@/lib/bigquery';
import { parseRange, rangeDateFilter } from '@/lib/bqQueries';
import { safeErrorDetail } from '@/lib/errors';

interface TagRow { label: string; count: number }

const STYLES_SQL = (dateFilter: string) => `
  SELECT s.name AS label, COUNT(DISTINCT p.postId) AS count
  FROM ${tableRef('post')} p
  JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE p.videoSummary IS NOT NULL
    AND ${dateFilter}
    AND s.name IS NOT NULL
  GROUP BY s.name
  ORDER BY count DESC
`;

const TOPICS_SQL = (dateFilter: string) => `
  SELECT t.name AS label, COUNT(DISTINCT p.postId) AS count
  FROM ${tableRef('post')} p
  JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  JOIN ${tableRef('topic')} t ON pt.topicId = t.id
  WHERE p.videoSummary IS NOT NULL
    AND ${dateFilter}
    AND t.name IS NOT NULL
  GROUP BY t.name
  ORDER BY count DESC
`;

export async function GET(request: Request): Promise<Response> {
  const range = parseRange(new URL(request.url).searchParams.get('range'), 'week');
  // rangeDateFilter returns an unqualified `postDate` predicate; only the post
  // table carries that column, so it resolves to p.postDate unambiguously.
  const dateFilter = rangeDateFilter(range);

  try {
    const [styleRows, topicRows] = await Promise.all([
      query<TagRow>(STYLES_SQL(dateFilter)),
      query<TagRow>(TOPICS_SQL(dateFilter)),
    ]);

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
