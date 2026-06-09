-- knox-mps-scored.sql
-- ---------------------
-- Knox Factor leaderboard with:
--   * Frequency: posts in the last 28 days, normalised to the dataset max, cap 7.5/100
--   * Followers axis: log-scaled relative to the platform's highest follower count, cap 100
--   * Low-volume penalty on the OVERALL score (harsher rule wins on overlap):
--       < 25  lifetime posts -> quarter (x0.25)
--       < 100 lifetime posts -> halve  (x0.5)
--       >= 100 lifetime posts -> no penalty
--   * Recency penalties, stacked multiplicatively with the above and each other:
--       0 posts in the last 7 days  -> x0.8
--       0 posts in the last 28 days -> x0.4
--     (0 in 28 days implies 0 in 7 days, so a dormant account takes both = x0.32)
--   * Low-views penalty (also stacked): lifetime avg views per post < 10,000 -> x0.7
--     (missing/zero avg views counts as below the threshold)
-- Per-axis caps used in the composite: virality 15, engagement 35, followers 60, frequency 7.5.
-- Spread tuning: followers and virality are LOG-scaled before normalising, and the
-- compression curve is set to 0.7 (< 1) so it EXPANDS scores away from 50.
-- NOTE: no account-type filter is applied, so this scores ALL accounts, not just MPs.

WITH base AS (
  SELECT
    a.id,
    a.displayName,
    a.party,
    a.profile,
    COALESCE(a.totalFollowers, 0)                       AS followersRaw,
    SAFE_DIVIDE(COALESCE(m.totalViews, 0),
                NULLIF(COALESCE(m.totalPosts, 0), 0))   AS avgViews,
    SAFE_DIVIDE(
      COALESCE(m.totalLikes,    0) +
      COALESCE(m.totalComments, 0) +
      COALESCE(m.totalSaves,    0) +
      COALESCE(m.totalShares,   0),
      NULLIF(COALESCE(m.totalViews, 0), 0)
    ) * 100                                              AS engRateRaw,
    COALESCE(m.totalPosts, 0)                            AS postsCount,         -- lifetime, drives the penalty
    COALESCE(pr.postsInRange, 0)                         AS postsInRange,       -- last 28 days, drives frequency
    COALESCE(pr7.postsLast7d, 0)                         AS postsLast7d         -- last 7 days, drives recency penalty
  FROM `project-ariadne.ariadne_tiktok_demo.account` a
  LEFT JOIN (
    SELECT axat.accountId,
           STRING_AGG(atype.name, ',') AS types
    FROM `project-ariadne.ariadne_tiktok_demo.account_x_accountType` axat
    JOIN `project-ariadne.ariadne_tiktok_demo.accountType` atype
      ON axat.accountTypeId = atype.id
    GROUP BY axat.accountId
  ) acct ON a.id = acct.accountId
  LEFT JOIN (
    SELECT * FROM `project-ariadne.ariadne_tiktok_demo.accountMetrics`
    WHERE dateUpdated = (
      SELECT MAX(dateUpdated)
      FROM `project-ariadne.ariadne_tiktok_demo.accountMetrics`
    )
  ) m ON a.id = m.pageId
  -- Frequency basis: number of posts published in the last 28 days, per account.
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsInRange
    FROM `project-ariadne.ariadne_tiktok_demo.post`
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pr ON LTRIM(a.profile, '@') = pr.profile
  -- Recency basis: number of posts published in the last 7 days, per account.
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsLast7d
    FROM `project-ariadne.ariadne_tiktok_demo.post`
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pr7 ON LTRIM(a.profile, '@') = pr7.profile
),
clamped AS (
  SELECT *,
    -- True unclamped ratio (kept for display only)
    COALESCE(SAFE_DIVIDE(avgViews, NULLIF(followersRaw, 0)), 0)        AS viralityRawTrue,
    -- Virality clamped at 0.5: outliers can't poison the dataset max
    LEAST(COALESCE(SAFE_DIVIDE(avgViews, NULLIF(followersRaw, 0)), 0),
          0.5)                                                          AS viralityRaw,
    -- Engagement clamped at 100%: anything above is a data artifact
    LEAST(engRateRaw, 100)                                              AS engRate
  FROM base
),
withMax AS (
  SELECT *,
    MAX(viralityRaw)   OVER () AS maxVirality,      -- caps at 0.5
    MAX(engRate)       OVER () AS maxEng,           -- caps at 100
    MAX(postsInRange)  OVER () AS maxPostsInRange,  -- frequency normaliser (28-day)
    MAX(followersRaw)  OVER () AS maxFollowers      -- highest follower count on the platform
  FROM clamped
),
normalised AS (
  SELECT *,
    -- Virality: log-scaled relative to the dataset max so a few high-reach
    -- accounts don't flatten everyone else. LN(1+x)/LN(1+max).
    LEAST(100, COALESCE(LN(1 + viralityRaw)  / NULLIF(LN(1 + maxVirality),    0), 0) * 100) AS vN,
    LEAST(100, COALESCE(engRate              / NULLIF(maxEng,                 0), 0) * 100) AS eN,
    LEAST(100, COALESCE(postsInRange         / NULLIF(maxPostsInRange,        0), 0) * 100) AS fN,
    -- Followers: log-scaled relative to the platform's highest follower count.
    -- LN(1+x)/LN(1+max) spreads the long tail instead of only rewarding the giant.
    LEAST(100, COALESCE(LN(1 + followersRaw) / NULLIF(LN(1 + maxFollowers),   0), 0) * 100) AS flN
  FROM withMax
),
composite AS (
  SELECT *,
    -- Per-axis caps: virality 20, engagement 50, followers 100, frequency 7.5.
    LEAST(100, GREATEST(0,
      (vN  / 100) * 15 +
      (eN  / 100) * 35 +
      (flN / 100) * 60 +
      (fN  / 100) * 7.5
    )) AS comp
  FROM normalised
),
curved AS (
  SELECT *,
    -- curveStrength 0.7 (< 1) EXPANDS away from 50, spreading top and bottom.
    50 + SIGN(comp - 50) * POWER(ABS(comp - 50) / 50, 0.7) * 50 AS curvedScore
  FROM composite
),
penalised AS (
  SELECT *,
    LEAST(100, GREATEST(0,
      CASE WHEN (vN + eN + fN + flN) > 0
        THEN GREATEST(curvedScore, 5)
        ELSE curvedScore
      END
    )) AS knoxBase,
    -- Low-volume penalty on lifetime posts (harsher rule wins on overlap):
    CASE
      WHEN postsCount < 25  THEN 0.25
      WHEN postsCount < 100 THEN 0.5
      ELSE 1.0
    END AS postPenalty,
    -- Recency penalties (stack with each other and with postPenalty):
    CASE WHEN postsLast7d  = 0 THEN 0.8 ELSE 1.0 END AS recency7Penalty,
    CASE WHEN postsInRange = 0 THEN 0.4 ELSE 1.0 END AS recency28Penalty,
    -- Low-views penalty: lifetime avg views per post below 10,000 (null/zero counts as below).
    CASE WHEN COALESCE(avgViews, 0) < 10000 THEN 0.7 ELSE 1.0 END AS lowViewsPenalty
  FROM curved
)
SELECT
  displayName,
  party,
  -- Final score: overall Knox x all penalties (multiplicative), re-clamped and rounded.
  CAST(ROUND(LEAST(100, GREATEST(0,
    knoxBase * postPenalty * recency7Penalty * recency28Penalty * lowViewsPenalty
  ))) AS INT64)                                             AS knoxFactor,
  CAST(ROUND(knoxBase) AS INT64)                            AS knoxFactorRaw,
  postPenalty,
  recency7Penalty,
  recency28Penalty,
  lowViewsPenalty,
  CAST(ROUND(vN)  AS INT64)                                  AS virality,
  CAST(ROUND(eN)  AS INT64)                                  AS engagement,
  CAST(ROUND(fN)  AS INT64)                                  AS frequency,        -- 28-day basis, cap 7.5
  CAST(ROUND(flN) AS INT64)                                  AS followers,        -- cap 100
  followersRaw                                               AS totalFollowers,
  CAST(ROUND(avgViews)    AS INT64)                          AS avgViewsPerPost,
  ROUND(viralityRawTrue, 4)                                  AS viralityRatio,
  ROUND(engRateRaw, 2)                                       AS engRatePct,
  postsLast7d                                                AS postsLast7d,
  postsInRange                                               AS postsLast28d,
  postsCount                                                 AS lifetimePosts
FROM penalised
ORDER BY knoxFactor DESC
