/**
 * app/api/ariadne+api.ts
 * -----------------------
 * Expo Router server API route. Runs in Node.js only — never sent to the browser.
 * Queries BigQuery and returns a Politician[] JSON array.
 *
 * GET  /api/ariadne          → full politician list
 * GET  /api/ariadne?debug=1  → returns raw field names + sample rows for schema verification
 */

import { query, tableRef } from '@/lib/bigquery';
import { signMediaFields } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { transformToPoliticians } from '@/data/transformers';
import type { BQAccountRow, BQPostRow } from '@/data/transformers';

// ── SQL ───────────────────────────────────────────────────────────────────────

/**
 * Accounts joined with their most recent accountMetrics row.
 * account.id = accountMetrics.pageId
 */
const ACCOUNTS_SQL = `
  SELECT
    a.id,
    a.name,
    a.profile,
    a.party,
    a.affiliation,
    COALESCE(a.totalFollowers, 0)  AS totalFollowers,
    COALESCE(a.totalFollowing, 0)  AS totalFollowing,
    COALESCE(m.totalPosts,     0)  AS totalPosts,
    COALESCE(m.totalLikes,     0)  AS totalLikes,
    COALESCE(m.totalViews,     0)  AS totalViews,
    COALESCE(m.totalComments,  0)  AS totalComments,
    COALESCE(m.totalShares,    0)  AS totalShares,
    COALESCE(m.totalSaves,     0)  AS totalSaves,
    COALESCE(m.postsToday,     0)  AS postsToday,
    COALESCE(pw.postsThisWeek, 0)  AS postsThisWeek,
    COALESCE(m.viewsToday,     0)  AS viewsToday,
    COALESCE(m.likesToday,     0)  AS likesToday,
    COALESCE(m.commentsToday,  0)  AS commentsToday,
    COALESCE(m.savesToday,     0)  AS savesToday,
    m.followerChange
  FROM ${tableRef('account')} a
  LEFT JOIN (
    SELECT *
    FROM ${tableRef('accountMetrics')}
    WHERE dateUpdated = (
      -- Use the most recent date that is NOT today.
      -- The scraper may run today before data is available, producing zeros.
      -- Capping at INTERVAL 1 DAY ensures we always get the last complete run.
      SELECT MAX(dateUpdated)
      FROM ${tableRef('accountMetrics')}
      WHERE dateUpdated <= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    )
  ) m ON a.id = m.pageId
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsThisWeek
    FROM ${tableRef('post')}
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pw ON LTRIM(a.profile, '@') = pw.profile
  ORDER BY a.name
`;

/**
 * Most recent 5 posts per account, partitioned by profile handle.
 * post.profile = account.profile (string join, not by ID).
 */
const POSTS_SQL = `
  SELECT
    postId,
    -- Normalise profile: strip any leading '@' so it always matches
    -- account.profile after the same normalisation in the transformer.
    LTRIM(profile, '@') AS profile,
    caption,
    videoSummary,
    COALESCE(views,    0) AS views,
    COALESCE(likes,    0) AS likes,
    COALESCE(comments, 0) AS comments,
    COALESCE(shares,   0) AS shares,
    COALESCE(saves,    0) AS saves,
    COALESCE(reposts,  0) AS reposts,
    CAST(postDate AS STRING) AS postDate,
    postUrl,
    coverJpeg,
    videoMp4,
    style
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY LTRIM(profile, '@')
        ORDER BY postDate DESC
      ) AS _rn
    FROM ${tableRef('post')}
  )
  WHERE _rn <= 5
`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const isDebug = new URL(request.url).searchParams.get('debug') === '1';

  // Debug mode: return raw schema info independently of the main query
  if (isDebug) {
    try {
      const DEBUG = (t: string) => `SELECT * FROM ${tableRef(t)} LIMIT 1`;
      const [acc, post, metrics] = await Promise.all([
        query<Record<string, unknown>>(DEBUG('account')),
        query<Record<string, unknown>>(DEBUG('post')),
        query<Record<string, unknown>>(DEBUG('accountMetrics')),
      ]);
      return Response.json({
        accountFields:  Object.keys(acc[0]    ?? {}),
        postFields:     Object.keys(post[0]   ?? {}),
        metricsFields:  Object.keys(metrics[0] ?? {}),
        accountSample:  acc[0],
        postSample:     post[0],
      });
    } catch (err: unknown) {
      const { clientDetail, logMessage } = safeErrorDetail(err);
      console.error('[/api/ariadne?debug=1] error:', logMessage);
      return Response.json(
        { error: 'Debug query failed', detail: clientDetail },
        { status: 500 }
      );
    }
  }

  // Main data fetch
  try {
    const [accountRows, postRows] = await Promise.all([
      query<BQAccountRow>(ACCOUNTS_SQL),
      query<BQPostRow>(POSTS_SQL),
    ]);

    const politicians = transformToPoliticians(accountRows, postRows);

    // Sign coverJpeg + videoMp4 for every recentPost across all politicians.
    await Promise.all(
      politicians.flatMap(p =>
        p.recentPosts.map(async (post, i) => {
          const signed = await signMediaFields(post);
          p.recentPosts[i] = signed;
        })
      )
    );

    return Response.json(
      { politicians },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/ariadne] BigQuery error:', logMessage);
    return Response.json(
      { error: 'Failed to fetch data from BigQuery', detail: clientDetail },
      { status: 500 }
    );
  }
}
