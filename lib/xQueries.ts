/**
 * lib/xQueries.ts
 * ----------------
 * X (Twitter) SQL builders — the X counterpart of lib/bqQueries.ts. Server-side
 * only. Every builder returns rows in the SAME shapes as its TikTok twin
 * (BQAccountRow, BQPostRow, the feed row), so transformToPoliticians, the Knox
 * Factor and the post feed handle X without a second code path.
 *
 * Membership is person-level: metadata.person_x_dashboard says who is on the
 * dashboard (rows with ended_at set have left it), metadata.account_link
 * (confirmed rows only) says which X account is theirs. X has no dashboard
 * table of its own.
 *
 * Field mapping onto the TikTok vocabulary:
 *   comments ← replies   shares ← reposts + quotes   saves ← bookmarks
 * so every engagement total = likes + replies + reposts + quotes + bookmarks.
 *
 * Reposts of OTHER accounts are excluded everywhere: twitter.post stores them
 * with the original tweet's numbers, so counting them would credit a leader
 * with someone else's reach. Quotes and replies are the leader's own words.
 *
 * One job: produce correct, safe SQL for X reads.
 */

import { prevRangeDateFilter, rangeDateFilter, type Range } from '@/lib/bqQueries';

const PROJECT = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const X   = (t: string) => `\`${PROJECT}.twitter.${t}\``;
const META = (t: string) => `\`${PROJECT}.metadata.${t}\``;

/**
 * Secondary X accounts left out when a person has more than one confirmed.
 * Lower-case, no '@'. Andy Burnham: @andyburnham only (decided 2026-10-26).
 */
export const X_SECONDARY_HANDLES = ['andyburnhamgm'];

function assertDashboardId(id: number): number {
  if (!Number.isInteger(id) || id < 1) throw new Error(`Invalid dashboardId: ${String(id)}`);
  return id;
}

/**
 * `links`: the one confirmed X account per person on the dashboard.
 * `own`:   those accounts' own posts (no reposts), with a DATE `postDate` so
 *          rangeDateFilter() applies unchanged.
 */
function xBaseCtes(dashboardId: number): string {
  const id = assertDashboardId(dashboardId);
  const hidden = X_SECONDARY_HANDLES.map(h => `'${h}'`).join(', ');
  return `
  links AS (
    SELECT l.person_id, l.platform_account_id AS author_id
    FROM ${META('account_link')} l
    JOIN ${META('person_x_dashboard')} d ON d.person_id = l.person_id AND d.dashboard_id = ${id} AND d.ended_at IS NULL
    WHERE l.status = 'confirmed' AND l.platform = 'x'
      AND LOWER(IFNULL(l.platform_handle, '')) NOT IN (${hidden})
    QUALIFY ROW_NUMBER() OVER (PARTITION BY l.person_id ORDER BY l.reviewed_at DESC) = 1
  ),
  own AS (
    SELECT p.*, DATE(p.createdAt) AS postDate, links.person_id
    FROM ${X('post')} p
    JOIN links ON p.authorId = links.author_id
    WHERE p.retweetTweetId IS NULL
      AND NOT STARTS_WITH(IFNULL(p.caption, ''), 'RT @')
  )`;
}

const ENG = (p: string) =>
  `COALESCE(${p}.likes, 0) + COALESCE(${p}.replies, 0) + COALESCE(${p}.retweets, 0) + COALESCE(${p}.quotes, 0) + COALESCE(${p}.bookmarks, 0)`;

// ── Accounts ─────────────────────────────────────────────────────────────────

/**
 * One row per X account on the dashboard, in BQAccountRow shape. Lifetime
 * totals come from the posts we hold (twitter.accountMetrics splits its
 * figures across partial daily rows, so it is not a reliable single source).
 */
export function buildXAccountsSQL(dashboardId: number, range: Range): string {
  const inRange = rangeDateFilter(range);
  return `
  WITH ${xBaseCtes(dashboardId)},
  agg AS (
    SELECT
      authorId,
      COUNT(*)                                              AS totalPosts,
      SUM(COALESCE(likes, 0))                               AS totalLikes,
      SUM(COALESCE(views, 0))                               AS totalViews,
      SUM(COALESCE(replies, 0))                             AS totalComments,
      SUM(COALESCE(retweets, 0) + COALESCE(quotes, 0))      AS totalShares,
      SUM(COALESCE(bookmarks, 0))                           AS totalSaves,
      SUM(${ENG('own')})                                    AS lifetimePostInteractions,
      COUNTIF(postDate = CURRENT_DATE())                    AS postsToday,
      COUNTIF(postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))  AS postsThisWeek,
      COUNTIF(postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY)) AS postsLast28d,
      COUNTIF(${inRange})                                   AS postsInRange,
      SUM(IF(${inRange}, COALESCE(views, 0), 0))            AS viewsInRange,
      SUM(IF(${inRange}, COALESCE(likes, 0), 0))            AS likesInRange,
      SUM(IF(${inRange}, COALESCE(replies, 0), 0))          AS commentsInRange,
      SUM(IF(${inRange}, COALESCE(bookmarks, 0), 0))        AS savesInRange,
      SUM(IF(${inRange}, COALESCE(retweets, 0) + COALESCE(quotes, 0), 0)) AS sharesInRange
    FROM own
    GROUP BY authorId
  )
  SELECT
    a.authorId                                AS id,
    COALESCE(pe.name, a.name)                 AS name,
    a.author                                  AS profile,
    pe.party                                  AS party,
    ''                                        AS affiliation,
    pe.display_job_title                      AS displayJobTitle,
    REPLACE(a.profilePicture, '_normal.', '_400x400.') AS avatar,
    pe.person_id,
    pe.slug                                   AS person_slug,
    pe.name                                   AS person_name,
    pe.display_job_title                      AS person_job_title,
    pe.party                                  AS person_party,
    pe.wing                                   AS person_wing,
    pe.location.country                       AS person_country,
    pe.location.region                        AS person_region,
    pe.location.constituency                  AS person_constituency,
    pe.location.latitude                      AS person_latitude,
    pe.location.longitude                     AS person_longitude,
    COALESCE(a.followersCount, 0)             AS totalFollowers,
    COALESCE(a.followingCount, 0)             AS totalFollowing,
    COALESCE(g.totalPosts, 0)                 AS totalPosts,
    COALESCE(g.totalLikes, 0)                 AS totalLikes,
    COALESCE(g.totalViews, 0)                 AS totalViews,
    COALESCE(g.totalComments, 0)              AS totalComments,
    COALESCE(g.totalShares, 0)                AS totalShares,
    COALESCE(g.totalSaves, 0)                 AS totalSaves,
    COALESCE(g.postsToday, 0)                 AS postsToday,
    COALESCE(g.postsThisWeek, 0)              AS postsThisWeek,
    COALESCE(g.postsLast28d, 0)               AS postsLast28d,
    0 AS viewsToday, 0 AS likesToday, 0 AS commentsToday, 0 AS savesToday,
    CAST(NULL AS INT64)                       AS followerChange,
    COALESCE(g.postsInRange, 0)               AS postsInRange,
    COALESCE(g.viewsInRange, 0)               AS viewsInRange,
    COALESCE(g.likesInRange, 0)               AS likesInRange,
    COALESCE(g.commentsInRange, 0)            AS commentsInRange,
    COALESCE(g.savesInRange, 0)               AS savesInRange,
    COALESCE(g.sharesInRange, 0)              AS sharesInRange,
    COALESCE(g.totalViews, 0)                 AS lifetimePostViews,
    COALESCE(g.totalPosts, 0)                 AS lifetimePostCount,
    COALESCE(g.lifetimePostInteractions, 0)   AS lifetimePostInteractions,
    CAST(NULL AS STRING)                      AS accountTypeNames
  FROM links l
  JOIN ${X('account')} a ON a.authorId = l.author_id
  JOIN ${META('person')} pe ON pe.person_id = l.person_id AND pe.is_active
  LEFT JOIN agg g ON g.authorId = a.authorId
  ORDER BY name
`;
}

// ── Posts (shared select for recent posts, the feed and the account page) ────

/**
 * Columns for one X post in the shared post shape, plus a `tweet` STRUCT the
 * UI turns into a tweet card. Expects `p` (an `own` row), `a` (twitter.account),
 * `md` (media aggregate), `q`/`qa` (quoted tweet and its author) in scope.
 */
const X_POST_COLUMNS = `
    'x'                                         AS platform,
    p.postId                                    AS postId,
    p.person_id                                 AS personId,
    a.author                                    AS profile,
    p.caption,
    p.postSummary                               AS videoSummary,
    COALESCE(p.views, 0)                        AS views,
    COALESCE(p.likes, 0)                        AS likes,
    COALESCE(p.replies, 0)                      AS comments,
    COALESCE(p.retweets, 0) + COALESCE(p.quotes, 0) AS shares,
    COALESCE(p.bookmarks, 0)                    AS saves,
    COALESCE(p.retweets, 0)                     AS reposts,
    CAST(p.postDate AS STRING)                  AS postDate,
    CONCAT('https://x.com/', a.author, '/status/', p.postId) AS postUrl,
    md.cover                                    AS coverJpeg,
    md.video                                    AS videoMp4,
    STRUCT(
      COALESCE(pe_name.name, a.name)            AS authorName,
      a.author                                  AS handle,
      REPLACE(a.profilePicture, '_normal.', '_400x400.') AS avatarUrl,
      (IFNULL(a.isBlueVerified, FALSE) OR a.verifiedType IS NOT NULL) AS verified,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', p.createdAt) AS createdAt,
      p.isReplyToUsername                       AS replyTo,
      COALESCE(p.likes, 0)                      AS likes,
      COALESCE(p.retweets, 0)                   AS reposts,
      COALESCE(p.replies, 0)                    AS replies,
      COALESCE(p.quotes, 0)                     AS quotes,
      COALESCE(p.bookmarks, 0)                  AS bookmarks,
      COALESCE(p.views, 0)                      AS views,
      IFNULL(md.items, [])                      AS media,
      p.linkUrl, p.linkTitle, p.linkDomain,
      TO_JSON_STRING(p.poll)                    AS pollJson,
      q.authorHandle                            AS quoteHandle,
      qa.name                                   AS quoteName,
      REPLACE(qa.profilePicture, '_normal.', '_400x400.') AS quoteAvatar,
      q.caption                                 AS quoteText,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', q.createdAt) AS quoteCreated
    )                                           AS tweet`;

/** Media for a set of posts (`ids`: a CTE/table with a postId column). */
function mediaCte(ids: string): string {
  return `
  md AS (
    SELECT
      m.postId,
      ARRAY_AGG(STRUCT(m.url, m.type) ORDER BY m.idx) AS items,
      ARRAY_AGG(IF(m.type IN ('photo', 'videoThumbnail', 'gifThumbnail', 'liveThumbnail'), m.url, NULL) IGNORE NULLS ORDER BY m.idx LIMIT 1)[SAFE_OFFSET(0)] AS cover,
      ARRAY_AGG(IF(m.type IN ('video', 'gif'), m.url, NULL) IGNORE NULLS ORDER BY m.idx LIMIT 1)[SAFE_OFFSET(0)] AS video
    FROM (
      SELECT m.postId, m.url, ANY_VALUE(m.mediaType) AS type,
             SAFE_CAST(REGEXP_EXTRACT(m.url, r'_(\\d+)(?:_thumb|_link)?$') AS INT64) AS idx
      FROM ${X('media')} m JOIN ${ids} i ON i.postId = m.postId
      GROUP BY 1, 2
    ) m
    GROUP BY m.postId
  )`;
}

const X_POST_JOINS = `
  JOIN ${X('account')} a ON a.authorId = p.authorId
  JOIN ${META('person')} pe_name ON pe_name.person_id = p.person_id
  LEFT JOIN md ON md.postId = p.postId
  LEFT JOIN ${X('post')} q ON q.postId = p.quoteTweetId
  LEFT JOIN ${X('account')} qa ON qa.authorId = q.authorId`;

/** Five most recent own posts per X account in range (the X buildPostsSQL). */
export function buildXPostsSQL(dashboardId: number, range: Range): string {
  return `
  WITH ${xBaseCtes(dashboardId)},
  recent AS (
    SELECT * FROM own
    WHERE ${rangeDateFilter(range)}
    QUALIFY ROW_NUMBER() OVER (PARTITION BY authorId ORDER BY createdAt DESC) <= 5
  ),
  ${mediaCte('recent')}
  SELECT ${X_POST_COLUMNS},
    CAST([] AS ARRAY<STRING>) AS styles
  FROM recent p
  ${X_POST_JOINS}
`;
}

/** Lifetime totals over the X posts we hold, for the hero tiles. */
export function buildXTotalsSQL(dashboardId: number): string {
  return `
  WITH ${xBaseCtes(dashboardId)}
  SELECT COUNT(*) AS totalPostsInDb, SUM(COALESCE(views, 0)) AS totalViewsInDb
  FROM own
`;
}

/** The most-viewed X post we hold, all time (the X buildTopPostSQL). */
export function buildXTopPostSQL(dashboardId: number): string {
  return `
  WITH ${xBaseCtes(dashboardId)}
  SELECT
    p.postId, p.caption, COALESCE(p.views, 0) AS views,
    CONCAT('https://x.com/', a.author, '/status/', p.postId) AS postUrl,
    COALESCE(pe.name, a.name) AS accountName,
    pe.location.region AS region, pe.party AS party
  FROM own p
  JOIN ${X('account')} a ON a.authorId = p.authorId
  JOIN ${META('person')} pe ON pe.person_id = p.person_id
  ORDER BY p.views DESC
  LIMIT 1
`;
}

// ── Feed (/api/posts) ────────────────────────────────────────────────────────

export interface XFeedFilters {
  since?:    string | null;   // ISO date, pre-validated
  /** ISO date, pre-validated; posts on or before it. */
  until?:    string | null;
  minViews?: number;
  minLikes?: number;
  /** X handle, lower-case, no '@'. */
  profile?:  string;
  /** metadata.topic name, lower-case. */
  topic?:    string;
  /** Region key. */
  region?:   string;
  /** person_id — matches whichever platform a selected leader is on. */
  personId?: string;
}

/**
 * X posts for the feed in the feed-row shape (minus ORDER/LIMIT, which the
 * caller applies over the union with TikTok). Uses @-params named x_*.
 */
export function buildXFeedSQL(dashboardId: number, f: XFeedFilters): { sql: string; params: Record<string, unknown> } {
  const where: string[] = ['TRUE'];
  const params: Record<string, unknown> = {};
  if (f.since)           where.push(`p.postDate >= DATE '${f.since}'`);
  if (f.until)           where.push(`p.postDate <= DATE '${f.until}'`);
  if (f.minViews)        { where.push('p.views >= @x_minViews'); params.x_minViews = f.minViews; }
  if (f.minLikes)        { where.push('p.likes >= @x_minLikes'); params.x_minLikes = f.minLikes; }
  if (f.profile)         { where.push('LOWER(a0.author) = @x_profile'); params.x_profile = f.profile; }
  if (f.personId)        { where.push('p.person_id = @x_person'); params.x_person = f.personId; }
  if (f.region)          { where.push('pe0.location.region = @x_region'); params.x_region = f.region; }
  if (f.topic) {
    where.push(`EXISTS (SELECT 1 FROM ${X('post_x_topic')} t2 JOIN ${META('topic')} tn ON tn.id = t2.topic_id WHERE t2.postId = p.postId AND LOWER(tn.name) = @x_topic)`);
    params.x_topic = f.topic;
  }

  const sql = `
  WITH ${xBaseCtes(dashboardId)},
  picked AS (
    SELECT p.*
    FROM own p
    JOIN ${X('account')} a0 ON a0.authorId = p.authorId
    JOIN ${META('person')} pe0 ON pe0.person_id = p.person_id
    WHERE ${where.join(' AND ')}
  ),
  ${mediaCte('picked')},
  topics AS (
    SELECT t.postId, ARRAY_AGG(DISTINCT tn.name IGNORE NULLS) AS names
    FROM ${X('post_x_topic')} t JOIN picked i ON i.postId = t.postId
    JOIN ${META('topic')} tn ON tn.id = t.topic_id
    GROUP BY t.postId
  )
  SELECT ${X_POST_COLUMNS},
    COALESCE(pe_name.name, a.name)       AS politicianName,
    pe_name.party                        AS party,
    pe_name.location.region              AS region,
    COALESCE(a.followersCount, 0)        AS accountFollowers,
    IFNULL(tp.names, [])                 AS topics,
    CAST([] AS ARRAY<STRING>)            AS styles
  FROM picked p
  ${X_POST_JOINS}
  LEFT JOIN topics tp ON tp.postId = p.postId`;
  return { sql, params };
}

// ── Leagues and benchmarks ───────────────────────────────────────────────────

/** Topic counts over X posts in range: { label, count } like the TikTok query. */
export function buildXTopicsSQL(dashboardId: number, range: Range): string {
  return `
  WITH ${xBaseCtes(dashboardId)}
  SELECT tn.name AS label, COUNT(DISTINCT p.postId) AS count
  FROM own p
  JOIN ${X('post_x_topic')} t ON t.postId = p.postId
  JOIN ${META('topic')} tn ON tn.id = t.topic_id
  WHERE ${rangeDateFilter(range)} AND tn.name IS NOT NULL
  GROUP BY tn.name
  ORDER BY count DESC
`;
}

/**
 * Views and engagement-rate distribution over X posts, in the column shape of
 * the TikTok BENCHMARKS_SQL so the same mapper reads both.
 */
export function buildXBenchmarksSQL(dashboardId: number): string {
  const ENG_PCT = `SAFE_DIVIDE(CAST(${ENG('own')} AS FLOAT64), views) * 100`;
  return `
  WITH ${xBaseCtes(dashboardId)}
  SELECT
    APPROX_QUANTILES(views, 4)[OFFSET(0)] AS views_min,
    APPROX_QUANTILES(views, 4)[OFFSET(1)] AS views_p25,
    APPROX_QUANTILES(views, 4)[OFFSET(2)] AS views_median,
    AVG(views)                            AS views_mean,
    APPROX_QUANTILES(views, 4)[OFFSET(3)] AS views_p75,
    APPROX_QUANTILES(views, 4)[OFFSET(4)] AS views_max,
    APPROX_QUANTILES(${ENG_PCT}, 4)[OFFSET(0)] AS eng_min,
    APPROX_QUANTILES(${ENG_PCT}, 4)[OFFSET(1)] AS eng_p25,
    APPROX_QUANTILES(${ENG_PCT}, 4)[OFFSET(2)] AS eng_median,
    AVG(${ENG_PCT})                            AS eng_mean,
    APPROX_QUANTILES(${ENG_PCT}, 4)[OFFSET(3)] AS eng_p75,
    APPROX_QUANTILES(${ENG_PCT}, 4)[OFFSET(4)] AS eng_max
  FROM own
  WHERE views > 0
`;
}

// ── Account page (/api/account-page) ─────────────────────────────────────────

/**
 * One person's X posts in `range` and the period before it, in the
 * BQAccountPagePostRow shape plus `platform`, `tweetJson` and `contentType`
 * (video, photo, poll, quote, link or text — what the post is, for the
 * Content card's Type tab). Needs @person.
 */
export function buildXAccountPagePostsSQL(dashboardId: number, range: Range, limit = 3000): string {
  const current = rangeDateFilter(range);
  return `
  WITH ${xBaseCtes(dashboardId)},
  picked AS (
    SELECT * FROM own
    WHERE person_id = @person AND ((${current}) OR (${prevRangeDateFilter(range)}))
  ),
  ${mediaCte('picked')},
  topics AS (
    SELECT t.postId, ARRAY_AGG(DISTINCT tn.name IGNORE NULLS) AS names
    FROM ${X('post_x_topic')} t JOIN picked i ON i.postId = t.postId
    JOIN ${META('topic')} tn ON tn.id = t.topic_id
    GROUP BY t.postId
  )
  SELECT x.* EXCEPT (tweet, createdAtTs), TO_JSON_STRING(x.tweet) AS tweetJson
  FROM (
    SELECT ${X_POST_COLUMNS},
      p.createdAt                               AS createdAtTs,
      IF(${current}, 'current', 'previous')     AS period,
      CASE
        WHEN md.video IS NOT NULL THEN 'video'
        WHEN EXISTS (SELECT 1 FROM UNNEST(md.items) i WHERE i.type = 'photo') THEN 'photo'
        WHEN p.poll IS NOT NULL AND TO_JSON_STRING(p.poll) != 'null' THEN 'poll'
        WHEN p.quoteTweetId IS NOT NULL THEN 'quote'
        WHEN p.linkUrl IS NOT NULL THEN 'link'
        ELSE 'text'
      END                                       AS contentType,
      IFNULL(tp.names, [])                      AS topics,
      CAST([] AS ARRAY<STRING>)                 AS styles
    FROM picked p
    ${X_POST_JOINS}
    LEFT JOIN topics tp ON tp.postId = p.postId
  ) x
  ORDER BY x.createdAtTs DESC
  LIMIT ${limit}
`;
}

/** One person's latest X post date, any range. Needs @person. */
export function buildXLastPostDateSQL(dashboardId: number): string {
  return `
  WITH ${xBaseCtes(dashboardId)}
  SELECT CAST(MAX(postDate) AS STRING) AS lastPostDate
  FROM own WHERE person_id = @person
`;
}
