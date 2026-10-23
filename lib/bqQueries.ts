/**
 * lib/bqQueries.ts
 * -----------------
 * Shared BigQuery SQL builders used by /api/ariadne and /api/account.
 * Server-side only — never import from client components.
 *
 * Every builder takes `dashboardId` FIRST. It comes from the request host via
 * lib/tenantRequest.ts, and is what scopes the query to one tenant's accounts
 * (1 = The Knox Index, 2 = World Leaders). There is no default on purpose.
 *
 * One job: produce correct, safe SQL strings for each query pattern.
 */

import { tableRef, accountWeb, postWeb } from '@/lib/bigquery';

// ── Range helpers ─────────────────────────────────────────────────────────────

export type Range = 'yesterday' | 'week' | 'month' | 'year' | 'lifetime';
export const VALID_RANGES: Range[] = ['yesterday', 'week', 'month', 'year', 'lifetime'];

export function parseRange(raw: string | null, defaultRange: Range = 'week'): Range {
  return VALID_RANGES.includes(raw as Range) ? (raw as Range) : defaultRange;
}

export function rangeDateFilter(range: Range): string {
  switch (range) {
    case 'yesterday': return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)`;
    case 'week':      return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`;
    case 'month':     return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`;
    case 'year':      return `EXTRACT(YEAR FROM postDate) = EXTRACT(YEAR FROM CURRENT_DATE())`;
    case 'lifetime':  return `postDate IS NOT NULL`;
  }
}

export const RANGE_LABELS: Record<Range, string> = {
  yesterday: 'Yesterday',
  week:      'Last 7 days',
  month:     'Last 30 days',
  year:      'This year',
  lifetime:  'Lifetime',
};

/**
 * Sanitise a TikTok handle for safe interpolation into SQL.
 * Allows only alphanumeric, dots, underscores, and hyphens — no quotes,
 * semicolons, or other characters that could mutate the query.
 */
export function sanitiseHandle(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80).toLowerCase();
}

// ── Hidden accounts ────────────────────────────────────────────────────────
//
// Handles excluded from every lookup (leaderboard, account list, rankings,
// account page, feed, top post). Compared case-insensitively with the leading
// '@' stripped. Single source — add a handle here to hide it everywhere.
export const HIDDEN_HANDLES = ['ukgov'];

/** SQL boolean that is true for rows NOT in HIDDEN_HANDLES. Pass the profile
 *  column expression (e.g. 'a.profile' or 'profile'). */
function excludeHidden(profileExpr: string): string {
  const list = HIDDEN_HANDLES.map(h => `'${h.toLowerCase()}'`).join(', ');
  return `LOWER(LTRIM(${profileExpr}, '@')) NOT IN (${list})`;
}

// ── Accounts SQL ──────────────────────────────────────────────────────────────

/**
 * All accounts joined with their latest accountMetrics row and range
 * aggregates from the post table. Returns one row per account.
 */
export function buildAccountsSQL(dashboardId: number, range: Range): string {
  const dateFilter = rangeDateFilter(range);
  const ACCOUNT_WEB = accountWeb(dashboardId);
  const POST_WEB    = postWeb(dashboardId);
  return `
  SELECT
    a.id,
    COALESCE(a.displayName, a.name) AS name,   -- prefer human display name over username
    a.profile,
    a.party,
    a.affiliation,
    a.displayJobTitle,
    a.avatar,
    -- from metadata.person, via accountWeb()
    a.person_slug,
    a.person_name,
    a.person_job_title,
    a.person_party,
    a.person_wing,
    a.person_country,
    a.person_region,
    a.person_constituency,
    a.person_latitude,
    a.person_longitude,
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
    COALESCE(p28.postsLast28d, 0)  AS postsLast28d,
    COALESCE(m.viewsToday,     0)  AS viewsToday,
    COALESCE(m.likesToday,     0)  AS likesToday,
    COALESCE(m.commentsToday,  0)  AS commentsToday,
    COALESCE(m.savesToday,     0)  AS savesToday,
    m.followerChange,
    COALESCE(ra.postsInRange,    0) AS postsInRange,
    COALESCE(ra.viewsInRange,    0) AS viewsInRange,
    COALESCE(ra.likesInRange,    0) AS likesInRange,
    COALESCE(ra.commentsInRange, 0) AS commentsInRange,
    COALESCE(ra.savesInRange,    0) AS savesInRange,
    COALESCE(ra.sharesInRange,   0) AS sharesInRange,
    COALESCE(la.lifetimePostViews, 0) AS lifetimePostViews,
    COALESCE(la.lifetimePostCount, 0) AS lifetimePostCount,
    COALESCE(la.lifetimePostInteractions, 0) AS lifetimePostInteractions,
    acct.accountTypeNames
  FROM ${ACCOUNT_WEB} a
  LEFT JOIN (
    SELECT axat.accountId, STRING_AGG(atype.name, ',' ORDER BY atype.id) AS accountTypeNames
    FROM ${tableRef('account_x_accountType')} axat
    JOIN ${tableRef('accountType')} atype ON axat.accountTypeId = atype.id
    GROUP BY axat.accountId
  ) acct ON a.id = acct.accountId
  LEFT JOIN (
    SELECT *
    FROM ${tableRef('accountMetrics')}
    WHERE dateUpdated = (
      SELECT MAX(dateUpdated)
      FROM ${tableRef('accountMetrics')}
    )
  ) m ON a.id = m.pageId
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsThisWeek
    FROM ${POST_WEB}
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pw ON LTRIM(a.profile, '@') = pw.profile
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsLast28d
    FROM ${POST_WEB}
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY)
    GROUP BY LTRIM(profile, '@')
  ) p28 ON LTRIM(a.profile, '@') = p28.profile
  LEFT JOIN (
    SELECT
      LTRIM(profile, '@')          AS profile,
      COUNT(*)                     AS postsInRange,
      SUM(COALESCE(views,    0))   AS viewsInRange,
      SUM(COALESCE(likes,    0))   AS likesInRange,
      SUM(COALESCE(comments, 0))   AS commentsInRange,
      SUM(COALESCE(saves,    0))   AS savesInRange,
      SUM(COALESCE(shares,   0))   AS sharesInRange
    FROM ${POST_WEB}
    WHERE ${dateFilter}
    GROUP BY LTRIM(profile, '@')
  ) ra ON LTRIM(a.profile, '@') = ra.profile
  LEFT JOIN (
    SELECT
      LTRIM(profile, '@')        AS profile,
      SUM(COALESCE(views, 0))    AS lifetimePostViews,
      COUNT(*)                   AS lifetimePostCount,
      SUM(COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(saves, 0) + COALESCE(shares, 0))
                                 AS lifetimePostInteractions
    FROM ${POST_WEB}
    WHERE postDate IS NOT NULL
    GROUP BY LTRIM(profile, '@')
  ) la ON LTRIM(a.profile, '@') = la.profile
  WHERE ${excludeHidden('a.profile')}
  ORDER BY a.name
`;
}

// ── Top post SQL ────────────────────────────────────────────────────────────

/**
 * The single most-viewed processed post across the entire dataset, ALL TIME.
 *
 * Range-independent by design — drives the KeyFindingsBar "Top performing post"
 * tile so it reports a true lifetime maximum rather than the top post within
 * the currently selected range. Joined to the account for display name + party.
 */
export function buildTopPostSQL(dashboardId: number): string {
  const ACCOUNT_WEB = accountWeb(dashboardId);
  const POST_WEB    = postWeb(dashboardId);
  return `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    p.caption,
    COALESCE(p.views, 0)     AS views,
    p.postUrl                AS postUrl,
    COALESCE(a.displayName, a.name) AS accountName,   -- prefer human display name over username
    LTRIM(LOWER(a.profile), '@')    AS profile,
    a.person_region          AS region,               -- from metadata.person, for region-grouped tenants
    a.party                  AS party
  FROM ${POST_WEB} p
  JOIN ${ACCOUNT_WEB} a
    ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  WHERE p.videoSummary IS NOT NULL AND ${excludeHidden('a.profile')}
  ORDER BY CAST(p.views AS INT64) DESC
  LIMIT 1
`;
}

// ── Posts SQL ─────────────────────────────────────────────────────────────────

/**
 * Most recent 5 processed posts per account within the selected range.
 * Used by /api/ariadne for the main dashboard feed.
 */
export function buildPostsSQL(dashboardId: number, range: Range): string {
  const dateFilter = rangeDateFilter(range);
  const POST_WEB   = postWeb(dashboardId);
  return `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    LTRIM(p.profile, '@') AS profile,
    p.caption,
    p.videoSummary,
    COALESCE(p.views,    0) AS views,
    COALESCE(p.likes,    0) AS likes,
    COALESCE(p.comments, 0) AS comments,
    COALESCE(p.shares,   0) AS shares,
    COALESCE(p.saves,    0) AS saves,
    COALESCE(p.reposts,  0) AS reposts,
    CAST(p.postDate AS STRING) AS postDate,
    p.postUrl,
    p.coverJpeg,
    p.videoMp4,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS styles
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY LTRIM(profile, '@')
        ORDER BY postDate DESC
      ) AS _rn
    FROM ${POST_WEB}
    WHERE videoSummary IS NOT NULL      AND ${dateFilter} AND ${excludeHidden('profile')}
  ) p
  LEFT JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  LEFT JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE p._rn <= 5
  GROUP BY
    p.postId, p.profile, p.caption, p.videoSummary,
    p.views, p.likes, p.comments, p.shares, p.saves, p.reposts,
    p.postDate, p.postUrl, p.coverJpeg, p.videoMp4
`;
}

/**
 * Up to [limit] most-recent processed posts for a single profile.
 * Used by /api/account for the full post feed on account pages.
 * Handle must be pre-sanitised with sanitiseHandle().
 */
export function buildAccountPostsSQL(dashboardId: number, handle: string, range: Range, limit = 20): string {
  const dateFilter = rangeDateFilter(range);
  const safe       = sanitiseHandle(handle);
  const POST_WEB   = postWeb(dashboardId);
  return `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    LTRIM(p.profile, '@') AS profile,
    p.caption,
    p.videoSummary,
    COALESCE(p.views,    0) AS views,
    COALESCE(p.likes,    0) AS likes,
    COALESCE(p.comments, 0) AS comments,
    COALESCE(p.shares,   0) AS shares,
    COALESCE(p.saves,    0) AS saves,
    COALESCE(p.reposts,  0) AS reposts,
    CAST(p.postDate AS STRING) AS postDate,
    p.postUrl,
    p.coverJpeg,
    p.videoMp4,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS styles
  FROM ${POST_WEB} p
  LEFT JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  LEFT JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE LTRIM(p.profile, '@') = '${safe}'
    AND ${excludeHidden('p.profile')}
    AND p.videoSummary IS NOT NULL    AND ${dateFilter}
  GROUP BY
    p.postId, p.profile, p.caption, p.videoSummary,
    p.views, p.likes, p.comments, p.shares, p.saves, p.reposts,
    p.postDate, p.postUrl, p.coverJpeg, p.videoMp4
  ORDER BY MAX(p.postDate) DESC
  LIMIT ${limit}
`;
}

/**
 * All processed posts for a single profile, newest first.
 * No date filter — used by the account page post feed which shows
 * the full history regardless of the selected range.
 */
export function buildAllAccountPostsSQL(dashboardId: number, handle: string, limit = 200): string {
  const safe     = sanitiseHandle(handle);
  const POST_WEB = postWeb(dashboardId);
  return `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    LTRIM(p.profile, '@') AS profile,
    p.caption,
    p.videoSummary,
    COALESCE(p.views,    0) AS views,
    COALESCE(p.likes,    0) AS likes,
    COALESCE(p.comments, 0) AS comments,
    COALESCE(p.shares,   0) AS shares,
    COALESCE(p.saves,    0) AS saves,
    COALESCE(p.reposts,  0) AS reposts,
    CAST(p.postDate AS STRING) AS postDate,
    p.postUrl,
    p.coverJpeg,
    p.videoMp4,
    ARRAY_AGG(DISTINCT s.name IGNORE NULLS) AS styles
  FROM ${POST_WEB} p
  LEFT JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  LEFT JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE LTRIM(p.profile, '@') = '${safe}'
    AND ${excludeHidden('p.profile')}
    AND p.videoSummary IS NOT NULL  GROUP BY
    p.postId, p.profile, p.caption, p.videoSummary,
    p.views, p.likes, p.comments, p.shares, p.saves, p.reposts,
    p.postDate, p.postUrl, p.coverJpeg, p.videoMp4
  ORDER BY MAX(p.postDate) DESC
  LIMIT ${limit}
`;
}

// ── Account page SQL ──────────────────────────────────────────────────────────

/**
 * The window just before `range`, for "vs prev. period" deltas. 'year' compares
 * this year-to-date with the same days last year. Lifetime has no previous
 * period, so it matches nothing.
 */
export function prevRangeDateFilter(range: Range): string {
  switch (range) {
    case 'yesterday': return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY) AND postDate < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)`;
    case 'week':      return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY) AND postDate < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`;
    case 'month':     return `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) AND postDate < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`;
    case 'year':      return `postDate >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR), YEAR) AND postDate <= DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR)`;
    case 'lifetime':  return `FALSE`;
  }
}

/**
 * One profile's posts in `range` and in the period before it, with their style
 * and topic names. `period` is 'current' or 'previous'. Unprocessed posts (no
 * videoSummary) are included so the counts match the account's real output.
 * Used by /api/account-page. Handle must be pre-sanitised with sanitiseHandle().
 */
export function buildAccountPagePostsSQL(dashboardId: number, handle: string, range: Range, limit = 3000): string {
  const safe     = sanitiseHandle(handle);
  const POST_WEB = postWeb(dashboardId);
  const current  = rangeDateFilter(range);
  return `
  WITH p AS (
    SELECT *
    FROM ${POST_WEB}
    WHERE LTRIM(profile, '@') = '${safe}'
      AND ${excludeHidden('profile')}
      AND ((${current}) OR (${prevRangeDateFilter(range)}))
  )
  SELECT
    CAST(p.postId AS STRING) AS postId,
    IF(${current}, 'current', 'previous') AS period,
    p.caption,
    p.videoSummary,
    COALESCE(p.views,    0) AS views,
    COALESCE(p.likes,    0) AS likes,
    COALESCE(p.comments, 0) AS comments,
    COALESCE(p.shares,   0) AS shares,
    COALESCE(p.saves,    0) AS saves,
    CAST(p.postDate AS STRING) AS postDate,
    p.postUrl,
    p.coverJpeg,
    p.videoMp4,
    ARRAY(
      SELECT DISTINCT s.name FROM ${tableRef('post_x_style')} pxs
      JOIN ${tableRef('style')} s ON pxs.styleId = s.id
      WHERE pxs.postId = p.postId AND s.name IS NOT NULL
    ) AS styles,
    ARRAY(
      SELECT DISTINCT t.name FROM ${tableRef('post_x_topic')} pxt
      JOIN ${tableRef('topic')} t ON pxt.topicId = t.id
      WHERE pxt.postId = p.postId AND t.name IS NOT NULL
    ) AS topics
  FROM p
  ORDER BY p.postDate DESC
  LIMIT ${limit}
`;
}

/** Date of one profile's most recent post, any range. */
export function buildLastPostDateSQL(dashboardId: number, handle: string): string {
  const safe = sanitiseHandle(handle);
  return `
  SELECT CAST(MAX(postDate) AS STRING) AS lastPostDate
  FROM ${postWeb(dashboardId)}
  WHERE LTRIM(profile, '@') = '${safe}'
    AND ${excludeHidden('profile')}
`;
}
