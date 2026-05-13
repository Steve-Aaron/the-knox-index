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
    m.followerChange,
    -- Account type sourced directly from the accountType table.
    -- LEFT JOIN so accounts with no type entry still appear; they fall back
    -- to regex inference in transformers.ts.
    acct.accountTypeName
  FROM ${tableRef('account')} a
  LEFT JOIN (
    SELECT axat.accountId, atype.name AS accountTypeName
    FROM ${tableRef('account_x_accountType')} axat
    JOIN ${tableRef('accountType')} atype ON axat.accountTypeId = atype.id
    QUALIFY ROW_NUMBER() OVER (PARTITION BY axat.accountId ORDER BY atype.id) = 1
  ) acct ON a.id = acct.accountId
  LEFT JOIN (
    SELECT *
    FROM ${tableRef('accountMetrics')}
    WHERE dateUpdated = (
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
    -- Only rank posts that have been fully processed by the pipeline.
    -- Unprocessed posts (no summary, no video URL) are excluded before
    -- the window function runs, so _rn reflects the most recent *processed* posts.
    WHERE videoSummary IS NOT NULL
      AND videoMp4     IS NOT NULL
  )
  WHERE _rn <= 5
`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const params  = new URL(request.url).searchParams;
  const isDebug = params.get('debug') === '1';
  const isDiag  = params.get('diag')  === '1';

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

  // Diagnostic mode: run each pipeline step in isolation to identify failures.
  // Hit /api/ariadne?diag=1 — never expose in production UI, check server logs too.
  if (isDiag) {
    const steps: Record<string, unknown> = {};

    // Step 1 — account JOIN accountMetrics (the complex accounts query)
    try {
      const rows = await query<Record<string, unknown>>(ACCOUNTS_SQL);
      steps['accounts_sql'] = { ok: true, row_count: rows.length, sample: rows[0] };
    } catch (err: unknown) {
      steps['accounts_sql'] = { ok: false, error: String(err) };
    }

    // Step 2 — posts window function
    try {
      const rows = await query<Record<string, unknown>>(POSTS_SQL);
      steps['posts_sql'] = { ok: true, row_count: rows.length, sample: rows[0] };
    } catch (err: unknown) {
      steps['posts_sql'] = { ok: false, error: String(err) };
    }

    // Step 3 — account_x_accountType join table accessibility
    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT * FROM ${tableRef('account_x_accountType')} LIMIT 1`
      );
      steps['account_x_accountType'] = { ok: true, row_count: rows.length, fields: Object.keys(rows[0] ?? {}) };
    } catch (err: unknown) {
      steps['account_x_accountType'] = { ok: false, error: String(err) };
    }

    // Step 4 — accountType table accessibility
    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT * FROM ${tableRef('accountType')} ORDER BY id`
      );
      steps['accountType'] = { ok: true, rows };
    } catch (err: unknown) {
      steps['accountType'] = { ok: false, error: String(err) };
    }

    return Response.json({ steps });
  }

  // Main data fetch
  try {
    const [accountRows, postRows] = await Promise.all([
      query<BQAccountRow>(ACCOUNTS_SQL),
      query<BQPostRow>(POSTS_SQL),
    ]);

    // accountTypeName is now joined inline in ACCOUNTS_SQL — no separate fetch needed.
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
