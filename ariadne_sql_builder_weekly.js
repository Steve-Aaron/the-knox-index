const TICK = String.fromCharCode(96);
const Q    = String.fromCharCode(39);
const BS   = String.fromCharCode(92);
const NL   = String.fromCharCode(10);
const PROJ = "project-ariadne";
const DSET = "ariadne_tiktok_demo";
const brief = $input.first().json;
const briefDateStr = (brief.briefDate && brief.briefDate.value) ? brief.briefDate.value : brief.briefDate;
const briefDateObj = new Date(briefDateStr + 'T00:00:00Z');
const weekStartObj = new Date(briefDateObj.getTime() - 6 * 86400000);
const weekStartStr = weekStartObj.toISOString().slice(0, 10);
const topPostsRoot = (Array.isArray(brief.topPostIds) ? (brief.topPostIds[0] || {}) : (brief.topPostIds || {}));
const unwrap = (v) => (Array.isArray(v) ? (v[0] || {}) : (v || {}));
const slots = [
  { rank: 1, category: 'MOST VIEWED',        ...unwrap(topPostsRoot.mostViews) },
  { rank: 2, category: '2ND MOST VIEWED',    ...unwrap(topPostsRoot.secondMostViews) },
  { rank: 3, category: '3RD MOST VIEWED',    ...unwrap(topPostsRoot.thirdMostViews) },
  { rank: 4, category: 'MOST VIRAL',         ...unwrap(topPostsRoot.mostViralPost) },
  { rank: 5, category: 'HIGHEST ENGAGEMENT', ...unwrap(topPostsRoot.highestEngagementPost) },
];
const sqlEscape = (s) => {
  let str = String(s == null ? '' : s);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (c === BS) out = out + BS + BS;
    else if (c === Q) out = out + BS + Q;
    else out = out + c;
  }
  return out;
};
const tableRef = (t) => TICK + PROJ + '.' + DSET + '.' + t + TICK;
// Reusable 7-day window predicate: the 7 days ending on (and including) briefDate.
const weekWhere = (col) =>
  'DATE(' + col + ') BETWEEN DATE_SUB(DATE(' + Q + sqlEscape(briefDateStr) + Q + '), INTERVAL 6 DAY)' + NL +
  '                         AND DATE(' + Q + sqlEscape(briefDateStr) + Q + ')';
const structRows = slots.map(s => 'STRUCT(' + s.rank + ' AS rank, ' + Q + sqlEscape(s.postId) + Q + ' AS postId)').join(',' + NL + '    ');
const MP_TYPE_FILTER    = "REGEXP_CONTAINS(COALESCE(typeNames, ''), r'member_of_parliament|cabinet_minister|shadow_cabinet_minister|party_leader|prime_minister')";
const PARTY_TYPE_FILTER = "COALESCE(typeNames, '') LIKE '%political_party%'";
const enrichSql = [
  'WITH slots AS (',
  '  SELECT * FROM UNNEST([',
  '    ' + structRows,
  '  ])',
  ')',
  'SELECT',
  '  s.rank,',
  '  CAST(p.postId AS STRING)      AS postId,',
  '  COALESCE(p.views,    0)       AS views,',
  '  COALESCE(p.likes,    0)       AS likes,',
  '  COALESCE(p.comments, 0)       AS comments,',
  '  COALESCE(p.shares,   0)       AS shares,',
  '  COALESCE(p.saves,    0)       AS saves,',
  '  p.coverJpeg                   AS thumbnailUrl,',
  '  p.postUrl                     AS videoUrl,',
  '  p.caption,',
  '  p.videoSummary,',
  '  CAST(p.postDate AS STRING)    AS postDate,',
  '  LTRIM(p.profile, ' + Q + '@' + Q + ')         AS profile,',
  '  a.name                        AS displayName,',
  '  LTRIM(a.profile, ' + Q + '@' + Q + ')         AS accountProfile,',
  '  a.party,',
  '  a.avatar                      AS avatar,',
  '  COALESCE(a.totalFollowers, 0) AS totalFollowers,',
  '  SAFE_DIVIDE(p.views, NULLIF(a.totalFollowers, 0))                          AS viralityScore,',
  '  SAFE_DIVIDE(p.likes + p.comments + p.shares + p.saves, NULLIF(p.views, 0)) AS engagementRate',
  'FROM slots s',
  'LEFT JOIN ' + tableRef('post') + ' p    ON CAST(p.postId AS STRING) = s.postId',
  'LEFT JOIN ' + tableRef('account') + ' a ON LTRIM(p.profile, ' + Q + '@' + Q + ')    = LTRIM(a.profile, ' + Q + '@' + Q + ')',
  'ORDER BY s.rank',
].join(NL);
const aggregateSql = [
  'WITH posts_in_week AS (',
  '  SELECT p.postId, p.views, p.likes, p.comments, p.shares, p.saves, LTRIM(p.profile, ' + Q + '@' + Q + ') AS profile',
  '  FROM ' + tableRef('post') + ' p',
  '  WHERE ' + weekWhere('p.postDate'),
  '),',
  'account_types AS (',
  '  SELECT a.id, LTRIM(a.profile, ' + Q + '@' + Q + ') AS profile, STRING_AGG(atype.name, ' + Q + ',' + Q + ') AS typeNames',
  '  FROM ' + tableRef('account') + ' a',
  '  LEFT JOIN ' + tableRef('account_x_accountType') + ' axat ON axat.accountId = a.id',
  '  LEFT JOIN ' + tableRef('accountType') + ' atype ON atype.id = axat.accountTypeId',
  '  GROUP BY a.id, a.profile',
  '),',
  'joined AS (',
  '  SELECT p.*, acct.id AS accountId, acct.typeNames',
  '  FROM posts_in_week p',
  '  LEFT JOIN account_types acct ON p.profile = acct.profile',
  ')',
  'SELECT ' + Q + 'mp' + Q + ' AS slice,',
  '       COUNT(DISTINCT postId)    AS posts,',
  '       COUNT(DISTINCT accountId) AS accounts,',
  '       COALESCE(SUM(views), 0)   AS views,',
  '       COALESCE(SAFE_DIVIDE(SUM(likes + comments + shares + saves), NULLIF(SUM(views), 0)) * 100, 0) AS engagementRate',
  'FROM joined',
  'WHERE ' + MP_TYPE_FILTER,
  'UNION ALL',
  'SELECT ' + Q + 'party' + Q + ',',
  '       COUNT(DISTINCT postId),',
  '       COUNT(DISTINCT accountId),',
  '       COALESCE(SUM(views), 0),',
  '       COALESCE(SAFE_DIVIDE(SUM(likes + comments + shares + saves), NULLIF(SUM(views), 0)) * 100, 0)',
  'FROM joined',
  'WHERE ' + PARTY_TYPE_FILTER,
].join(NL);
const totalAggregateSql = [
  'SELECT',
  '  COUNT(DISTINCT postId)                AS posts,',
  '  COUNT(DISTINCT LTRIM(profile, ' + Q + '@' + Q + '))  AS accounts,',
  '  COALESCE(SUM(views), 0)               AS views,',
  '  COALESCE(SAFE_DIVIDE(SUM(likes + comments + shares + saves), NULLIF(SUM(views), 0)) * 100, 0) AS engagementRate',
  'FROM ' + tableRef('post'),
  'WHERE ' + weekWhere('postDate'),
].join(NL);
const topPosterSql = (typeFilter) => [
  'WITH account_types AS (',
  '  SELECT a.id, LTRIM(a.profile, ' + Q + '@' + Q + ') AS profile, STRING_AGG(atype.name, ' + Q + ',' + Q + ') AS typeNames',
  '  FROM ' + tableRef('account') + ' a',
  '  LEFT JOIN ' + tableRef('account_x_accountType') + ' axat ON axat.accountId = a.id',
  '  LEFT JOIN ' + tableRef('accountType') + ' atype ON atype.id = axat.accountTypeId',
  '  GROUP BY a.id, a.profile',
  '),',
  'typed_posts AS (',
  '  SELECT p.postId, p.views, p.likes, p.comments, p.shares, p.saves,',
  '         p.coverJpeg, p.postUrl, p.caption, p.videoSummary, p.postDate,',
  '         LTRIM(p.profile, ' + Q + '@' + Q + ') AS profile,',
  '         acct.id AS accountId, acct.typeNames',
  '  FROM ' + tableRef('post') + ' p',
  '  LEFT JOIN account_types acct ON LTRIM(p.profile, ' + Q + '@' + Q + ') = acct.profile',
  '  WHERE ' + weekWhere('p.postDate'),
  ')',
  'SELECT',
  '  CAST(tp.postId AS STRING) AS postId,',
  '  COALESCE(tp.views,    0)  AS views,',
  '  COALESCE(tp.likes,    0)  AS likes,',
  '  COALESCE(tp.comments, 0)  AS comments,',
  '  COALESCE(tp.shares,   0)  AS shares,',
  '  COALESCE(tp.saves,    0)  AS saves,',
  '  tp.coverJpeg              AS thumbnailUrl,',
  '  tp.postUrl                AS videoUrl,',
  '  tp.caption,',
  '  tp.videoSummary,',
  '  tp.profile,',
  '  a.name                    AS displayName,',
  '  a.party,',
  '  a.avatar,',
  '  COALESCE(a.totalFollowers, 0) AS totalFollowers,',
  '  SAFE_DIVIDE(tp.views, NULLIF(a.totalFollowers, 0)) AS viralityScore,',
  '  SAFE_DIVIDE(tp.likes + tp.comments + tp.shares + tp.saves, NULLIF(tp.views, 0)) AS engagementRate',
  'FROM typed_posts tp',
  'LEFT JOIN ' + tableRef('account') + ' a ON LTRIM(a.profile, ' + Q + '@' + Q + ') = tp.profile',
  'WHERE ' + typeFilter.split('typeNames').join('tp.typeNames'),
  'ORDER BY tp.views DESC',
  'LIMIT 1',
].join(NL);
const weekTopSql = [
  'SELECT',
  '  CAST(p.postId AS STRING)      AS postId,',
  '  COALESCE(p.views,    0)       AS views,',
  '  COALESCE(p.likes,    0)       AS likes,',
  '  COALESCE(p.comments, 0)       AS comments,',
  '  COALESCE(p.shares,   0)       AS shares,',
  '  COALESCE(p.saves,    0)       AS saves,',
  '  p.coverJpeg                   AS thumbnailUrl,',
  '  p.postUrl                     AS videoUrl,',
  '  p.caption,',
  '  p.videoSummary,',
  '  LTRIM(p.profile, ' + Q + '@' + Q + ')         AS profile,',
  '  a.name                        AS displayName,',
  '  a.party,',
  '  COALESCE(a.totalFollowers, 0) AS totalFollowers,',
  '  SAFE_DIVIDE(p.views, NULLIF(a.totalFollowers, 0))                          AS viralityScore,',
  '  SAFE_DIVIDE(p.likes + p.comments + p.shares + p.saves, NULLIF(p.views, 0)) AS engagementRate',
  'FROM ' + tableRef('post') + ' p',
  'LEFT JOIN ' + tableRef('account') + ' a ON LTRIM(a.profile, ' + Q + '@' + Q + ') = LTRIM(p.profile, ' + Q + '@' + Q + ')',
  'WHERE ' + weekWhere('p.postDate'),
  'ORDER BY p.views DESC',
  'LIMIT 3',
].join(NL);
return [{ json: {
  briefing: brief,
  briefDateStr,
  weekStartStr,
  slots,
  enrichSql,
  weekAggSql:    aggregateSql,
  totalWeekSql:  totalAggregateSql,
  mpPosterSql:   topPosterSql(MP_TYPE_FILTER),
  partyPosterSql: topPosterSql(PARTY_TYPE_FILTER),
  weekTopSql,
} }];
