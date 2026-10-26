/**
 * app/api/posts+api.ts
 * ---------------------
 * Returns all posts joined with account names, style, and topic tags.
 * Used by the PostsTable section on the dashboard.
 *
 * GET /api/posts                 → every processed post, all time, ordered by sortKey
 * GET /api/posts?since=YYYY-MM-DD → posts on or after that date
 * GET /api/posts?sortKey=views    → server-side ORDER BY (views|likes|comments|
 *                                   shares|engagement|virality|postDate)
 *
 * No row cap — the full ordered set is returned so the true top-viewed /
 * top-engaged posts always appear.
 */

import { getBigQuery, tableRef, accountWeb, postWeb } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { groupKeyFor, isWarehouseGroup } from '@/data/grouping';
import { signMediaFields } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { partyKeyToRawNames } from '@/data/partyUtils';
import type { PostRecord } from '@/data/types';
import { buildXFeedSQL } from '@/lib/xQueries';
import { toTweetData, signTweetMedia, type RawTweet } from '@/lib/xPosts';
import { parsePlatformFilter } from '@/lib/platforms';

interface BQPostRecordRow {
  platform?:        'tiktok' | 'x';
  tweetJson?:       string | null;
  postId:           string;
  profile:          string;
  politicianName:   string;
  party:            string;
  region:           string | null;
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

/**
 * Whitelist of sort keys → BigQuery ORDER BY expressions. Whitelisting (rather
 * than interpolating user input) is the SQL-injection guard.
 *
 * Each key maps to a primary sort expression DESC plus a secondary tie-breaker
 * (postDate DESC) so identical primary values get a stable date ordering.
 */
const ORDER_BY_FOR_SORT_KEY: Record<string, string> = {
  views:      'p.views    DESC, p.postDate DESC',
  likes:      'p.likes    DESC, p.postDate DESC',
  comments:   'p.comments DESC, p.postDate DESC',
  shares:     'p.shares   DESC, p.postDate DESC',
  engagement: 'SAFE_DIVIDE(p.likes + p.comments + p.saves + p.shares, NULLIF(p.views, 0)) DESC, p.postDate DESC',
  virality:   'SAFE_DIVIDE(p.views, NULLIF(a.totalFollowers, 0)) DESC, p.postDate DESC',
  postDate:   'p.postDate DESC, p.views DESC',
};

const TIKTOK_FEED_SELECT = (dashboardId: number, whereClause: string) => `
  SELECT
    'tiktok'                     AS platform,
    CAST(NULL AS STRING)         AS tweetJson,
    CAST(p.postId AS STRING) AS postId,
    p.profile,
    a.name        AS politicianName,
    a.party,
    a.person_region AS region,
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
  FROM ${postWeb(dashboardId)} p
  LEFT JOIN ${accountWeb(dashboardId)} a ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  LEFT JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  LEFT JOIN ${tableRef('topic')} t ON pt.topicId = t.id
  LEFT JOIN ${tableRef('post_x_style')} pxs ON p.postId = pxs.postId
  LEFT JOIN ${tableRef('style')} s ON pxs.styleId = s.id
  WHERE ${whereClause}
  GROUP BY
    p.postId, p.profile, a.name, a.party,
    p.caption, p.videoSummary, p.coverJpeg, p.videoMp4,
    p.postUrl, p.postDate,
    p.views, p.likes, p.comments, p.shares, p.saves,
    a.totalFollowers, a.person_region
`;

const POSTS_SQL = (dashboardId: number, whereClause: string, orderBy: string, limit: number, offset: number) => `
  ${TIKTOK_FEED_SELECT(dashboardId, whereClause)}
  ORDER BY ${orderBy}
  LIMIT ${limit} OFFSET ${offset}
`;

/** Columns both platforms' feed rows share, in UNION order. */
const FEED_COLUMNS = `platform, postId, profile, politicianName, party, region, caption, videoSummary,
  coverJpeg, videoMp4, postUrl, postDate, views, likes, comments, shares, saves,
  accountFollowers, topics, styles, tweetJson`;

/** ORDER BY over the unioned rows (column names, no table aliases). */
const UNION_ORDER_BY: Record<string, string> = {
  views:      'views DESC, postDate DESC',
  likes:      'likes DESC, postDate DESC',
  comments:   'comments DESC, postDate DESC',
  shares:     'shares DESC, postDate DESC',
  engagement: 'SAFE_DIVIDE(likes + comments + saves + shares, NULLIF(views, 0)) DESC, postDate DESC',
  virality:   'SAFE_DIVIDE(views, NULLIF(accountFollowers, 0)) DESC, postDate DESC',
  postDate:   'postDate DESC, views DESC',
};

/** TikTok and X feed rows as one ordered, paged list. */
const UNION_POSTS_SQL = (tiktokSelect: string | null, xSelect: string, orderBy: string, limit: number, offset: number) => `
  SELECT ${FEED_COLUMNS}
  FROM (
    ${tiktokSelect ? `SELECT ${FEED_COLUMNS} FROM (${tiktokSelect})
    UNION ALL` : ''}
    SELECT ${FEED_COLUMNS.replace('tweetJson', 'TO_JSON_STRING(tweet) AS tweetJson')} FROM (${xSelect})
  )
  ORDER BY ${orderBy}
  LIMIT ${limit} OFFSET ${offset}
`;

// Total matching rows for the same filters (no LIMIT) — drives the real feed
// count instead of the misleading 'first page' size.
const COUNT_SQL = (dashboardId: number, whereClause: string) => `
  SELECT COUNT(DISTINCT p.postId) AS total
  FROM ${postWeb(dashboardId)} p
  LEFT JOIN ${accountWeb(dashboardId)} a ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  WHERE ${whereClause}
`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<Response> {
  // Tenant gate FIRST — resolves the dashboard and refuses unauthorised reads.
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;
  const dashboardId = tenant.dashboardId;

  const params = new URL(request.url).searchParams;
  // Server-side pagination: the query is ordered server-side by the selected
  // sort key, then a single page (LIMIT/OFFSET) is returned and signed. The
  // client walks the full ordered set page by page, so the genuine top-viewed /
  // top-engaged posts are reachable without ever capping the dataset.
  const rawSince = params.get('since') ?? null;
  const since = rawSince && ISO_DATE.test(rawSince) ? rawSince : null;

  // sortKey is whitelisted — unknown values fall back to postDate. This is what
  // protects against SQL injection via the sortKey parameter.
  const platform = parsePlatformFilter(params.get('platform') ?? 'tiktok');
  // person_id of a selected leader: matches them on whichever platform(s).
  const personId = (params.get('person') ?? '').trim();

  const rawSortKey = params.get('sortKey') ?? 'postDate';
  const orderBy    = ORDER_BY_FOR_SORT_KEY[rawSortKey] ?? ORDER_BY_FOR_SORT_KEY.postDate;

  // Page window. limit is bounded so a single request never signs too many URLs.
  const limit  = Math.min(Math.max(parseInt(params.get('limit') ?? '200', 10) || 200, 1), 500);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  // ── Structured server-side filters ──────────────────────────────────────────
  // Applied inside the BigQuery WHERE so they search the whole table, not just
  // the loaded page (fixes e.g. a party with no posts in the first page showing
  // '0' on lifetime). Values are parameterised, so injection-safe. The 'wing'
  // filter and AdvancedFilterPanel custom rules remain client-side for now.
  const queryParams: Record<string, unknown> = {};
  const where: string[] = ['p.videoSummary IS NOT NULL'];
  if (since) where.push(`p.postDate >= DATE '${since}'`);

  const minViews = Math.max(parseInt(params.get('minViews') ?? '0', 10) || 0, 0);
  if (minViews > 0) { where.push('p.views >= @minViews'); queryParams.minViews = minViews; }

  const minLikes = Math.max(parseInt(params.get('minLikes') ?? '0', 10) || 0, 0);
  if (minLikes > 0) { where.push('p.likes >= @minLikes'); queryParams.minLikes = minLikes; }

  // Politician identity is the account handle (stable), not the display name —
  // matching on a.name misses posts when the leaderboard name and a.name differ.
  const profile = (params.get('profile') ?? '').trim().toLowerCase().replace(/^@+/, '');
  if (profile && !personId) { where.push(`LTRIM(LOWER(p.profile), '@') = @profile`); queryParams.profile = profile; }
  if (personId) { where.push('a.person_id = @person'); queryParams.person = personId; }

  const style = (params.get('style') ?? '').trim().toLowerCase();
  if (style) {
    where.push(`EXISTS (SELECT 1 FROM ${tableRef('post_x_style')} pxs2 JOIN ${tableRef('style')} s2 ON pxs2.styleId = s2.id WHERE pxs2.postId = p.postId AND LOWER(s2.name) = @style)`);
    queryParams.style = style;
  }

  const topic = (params.get('topic') ?? '').trim().toLowerCase();
  if (topic) {
    where.push(`EXISTS (SELECT 1 FROM ${tableRef('post_x_topic')} pt2 JOIN ${tableRef('topic')} t2 ON pt2.topicId = t2.id WHERE pt2.postId = p.postId AND LOWER(t2.name) = @topic)`);
    queryParams.topic = topic;
  }

  // Group filter. The client sends ?group=<key>; ?party=<key> is still accepted
  // so older clients keep working. What the key MEANS depends on the tenant:
  //   party mode  → map back to the raw a.party spellings and match the column
  //   region mode → membership lives in data/leaderRegions.ts, so the key
  //                 becomes the handle list for that region
  const groupKey = (params.get('group') ?? params.get('party') ?? '').trim();
  if (groupKey) {
    if (isWarehouseGroup(tenant.grouping.mode)) {
      // Region lives on metadata.person, joined in by accountWeb(), so this is
      // a column predicate rather than an expanded list of handles.
      where.push('a.person_region = @groupRegion');
      queryParams.groupRegion = groupKey;
    } else {
      const partyNames = partyKeyToRawNames(groupKey);
      if (partyNames.length) {
        where.push(`REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(a.party)), r'[_-]+', ' '), r' +', ' ') IN UNNEST(@partyNames)`);
        queryParams.partyNames = partyNames;
      }
    }
  }

  const whereClause = where.join('\n    AND ');

  try {
    const bq = getBigQuery();
    // Only count on the first page; later pages reuse the client's cached total.
    const wantTotal = offset === 0;
    let rows: BQPostRecordRow[];
    let total: number | null;

    if (platform === 'tiktok') {
      const [pageResult, countResult]: any[] = await Promise.all([
        bq.query({ query: POSTS_SQL(dashboardId, whereClause, orderBy, limit, offset), params: queryParams, location: 'EU' }),
        wantTotal
          ? bq.query({ query: COUNT_SQL(dashboardId, whereClause), params: queryParams, location: 'EU' })
          : Promise.resolve([[{ total: null }]]),
      ]);
      rows  = pageResult[0] as BQPostRecordRow[];
      total = wantTotal ? Number(countResult[0]?.[0]?.total ?? 0) : null;
    } else {
      // X has no styles, so a style filter leaves only TikTok posts in play.
      const xFeed = style ? null : buildXFeedSQL(dashboardId, {
        since, minViews, minLikes, topic: topic || undefined, personId: personId || undefined,
        profile: personId ? undefined : profile || undefined,
        region: groupKey && isWarehouseGroup(tenant.grouping.mode) ? groupKey : undefined,
      });
      const tiktokSelect = platform === 'all' ? TIKTOK_FEED_SELECT(dashboardId, whereClause) : null;
      const unionOrder = UNION_ORDER_BY[rawSortKey] ?? UNION_ORDER_BY.postDate;
      const params = { ...queryParams, ...(xFeed?.params ?? {}) };
      const pageSql = xFeed
        ? UNION_POSTS_SQL(tiktokSelect, xFeed.sql, unionOrder, limit, offset)
        : tiktokSelect ? `${tiktokSelect} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}` : null;
      const [pageResult, tkCount, xCount]: any[] = await Promise.all([
        pageSql ? bq.query({ query: pageSql, params, location: 'EU' }) : [[]],
        wantTotal && tiktokSelect ? bq.query({ query: COUNT_SQL(dashboardId, whereClause), params: queryParams, location: 'EU' }) : [[{ total: 0 }]],
        wantTotal && xFeed ? bq.query({ query: `SELECT COUNT(*) AS total FROM (${xFeed.sql})`, params: xFeed.params, location: 'EU' }) : [[{ total: 0 }]],
      ]);
      rows  = pageResult[0] as BQPostRecordRow[];
      total = wantTotal ? Number(tkCount[0]?.[0]?.total ?? 0) + Number(xCount[0]?.[0]?.total ?? 0) : null;
    }

    // Sign coverJpeg + videoMp4 for every row in parallel (1-hour TTL each).
    const signedRows = await Promise.all(rows.map(r => signMediaFields(r)));
    const tweets = await Promise.all(signedRows.map(async r => {
      if (!r.tweetJson) return undefined;
      const tweet = toTweetData(JSON.parse(r.tweetJson) as RawTweet);
      await signTweetMedia(tweet);
      return tweet;
    }));

    const posts: PostRecord[] = signedRows.map((r, i) => ({
      platform:       r.platform ?? 'tiktok',
      tweet:          tweets[i],
      postId:         String(r.postId),
      profile:        r.profile,
      politicianName: r.politicianName ?? r.profile,
      groupKey:       groupKeyFor(tenant.grouping.mode, { party: r.party, region: r.region }),
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

    // hasMore: a full page back implies there is likely another page.
    const hasMore = rows.length === limit;

    // Cache shorter than TTL so clients never hold an expired signed URL.
    return Response.json(
      { posts, hasMore, total },
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
