/**
 * app/api/posts+api.ts
 * ---------------------
 * Returns all posts joined with account names, style, and topic tags.
 * Used by the PostsTable section on the dashboard.
 *
 * GET /api/posts               → last 200 posts, all time
 * GET /api/posts?since=YYYY-MM-DD → posts on or after that date
 * GET /api/posts?limit=N       → cap result rows
 */

import { query, tableRef } from '@/lib/bigquery';
import { signMediaFields } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { toPartyKeyPublic } from '@/data/partyUtils';
import type { PostRecord } from '@/data/types';

interface BQPostRecordRow {
  postId:           string;
  profile:          string;
  politicianName:   string;
  party:            string;
  caption:          string;
  videoSummary:     string;
  coverJpeg:        string;
  videoMp4:         string;
  postUrl:          string;
  postDate:         string;
  styles:           string[] | null;
  topics:           string[] | null;
  views:            number;
  likes:            number;
  comments:         number;
  shares:           number;
  saves:            number;
  accountFollowers: number;
}

const POSTS_SQL = (limit: number, since: string | null) => `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    p.profile,
    a.name        AS politicianName,
    a.party,
    p.caption,
    p.videoSummary,
    COALESCE(p.coverJpeg,   '')  AS coverJpeg,
    p.videoMp4,
    COALESCE(p.postUrl,     '')  AS postUrl,
    CAST(p.postDate AS STRING)   AS postDate,
    COALESCE(p.views,    0)      AS views,
    COALESCE(p.likes,    0)      AS likes,
    COALESCE(p.comments, 0)      AS comments,
    COALESCE(p.shares,   0)      AS shares,
    COALESCE(p.saves,    0)      AS saves,
    COALESCE(a.totalFollowers, 0) AS accountFollowers,
    ARRAY_AGG(DISTINCT t.name IGNORE NULLS) AS topics,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS styles
  FROM ${tableRef('post')} p
  LEFT JOIN ${tableRef('account')} a ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  LEFT JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  LEFT JOIN ${tableRef('topic')} t ON pt.topicId = t.id
  LEFT JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  LEFT JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE p.videoSummary IS NOT NULL
    AND p.videoMp4     IS NOT NULL
    ${since ? `AND p.postDate >= DATE '${since}'` : ''}
  GROUP BY
    p.postId, p.profile, a.name, a.party,
    p.caption, p.videoSummary, p.coverJpeg, p.videoMp4,
    p.postUrl, p.postDate,
    p.views, p.likes, p.comments, p.shares, p.saves,
    a.totalFollowers
  ORDER BY p.postDate DESC, p.views DESC
  LIMIT ${limit}
`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const rawLimit = parseInt(params.get('limit') ?? '200', 10);
  const limit = Math.min(isNaN(rawLimit) ? 200 : rawLimit, 500);
  const rawSince = params.get('since') ?? null;
  const since = rawSince && ISO_DATE.test(rawSince) ? rawSince : null;

  try {
    const rows = await query<BQPostRecordRow>(POSTS_SQL(limit, since));

    // Sign coverJpeg + videoMp4 for every row in parallel (1-hour TTL each).
    const signedRows = await Promise.all(rows.map(r => signMediaFields(r)));

    const posts: PostRecord[] = signedRows.map(r => ({
      postId:         String(r.postId),
      profile:        r.profile,
      politicianName: r.politicianName ?? r.profile,
      partyKey:       toPartyKeyPublic(r.party),
      caption:        r.caption      ?? '',
      videoSummary:   r.videoSummary ?? '',
      coverJpeg:      r.coverJpeg    ?? '',
      videoMp4:       r.videoMp4     ?? '',
      postUrl:        r.postUrl      ?? '',
      postDate:       r.postDate     ?? '',
      styles:         Array.isArray(r.styles) ? r.styles.filter(Boolean) : [],
      topics:         Array.isArray(r.topics) ? r.topics.filter(Boolean) : [],
      views:          r.views        ?? 0,
      likes:          r.likes        ?? 0,
      comments:       r.comments     ?? 0,
      shares:         r.shares       ?? 0,
      saves:          r.saves        ?? 0,
      accountFollowers: r.accountFollowers ?? 0,
    }));

    // Cache shorter than TTL so clients never hold an expired signed URL.
    return Response.json(
      { posts },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/posts] BigQuery error:', logMessage);
    return Response.json(
      { error: 'Failed to fetch posts', detail: clientDetail },
      { status: 500 }
    );
  }
}
