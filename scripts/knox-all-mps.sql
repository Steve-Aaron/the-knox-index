-- ─────────────────────────────────────────────────────────────────────────────
-- Knox Factor — every Member of Parliament account, lifetime range.
-- Mirrors data/knoxConfig.ts + data/transformers.ts exactly:
--   caps      = virality 5, engagement 100, frequency 150, followers 50
--   curve     = 1.3 around pivot 50
--   minScore  = 5 if any axis has signal
--   virality  = avgViewsPerPost / followers   (NEW formula)
-- Paste into BigQuery console (project-ariadne) and run.
-- ─────────────────────────────────────────────────────────────────────────────

WITH base AS (
  SELECT
    a.id,
    a.name,
    a.party,
    a.profile,
    COALESCE(a.totalFollowers, 0)                       AS followersRaw,
    -- avg views per post (lifetime)
    SAFE_DIVIDE(COALESCE(m.totalViews, 0),
                NULLIF(COALESCE(m.totalPosts, 0), 0))   AS avgViews,
    -- engagement rate % (lifetime)
    SAFE_DIVIDE(
      COALESCE(m.totalLikes,    0) +
      COALESCE(m.totalComments, 0) +
      COALESCE(m.totalSaves,    0) +
      COALESCE(m.totalShares,   0),
      NULLIF(COALESCE(m.totalViews, 0), 0)
    ) * 100                                              AS engRate,
    COALESCE(m.totalPosts, 0)                            AS postsCount
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
  WHERE acct.types LIKE '%member_of_parliament%'
),

withVirality AS (
  SELECT *,
    COALESCE(SAFE_DIVIDE(avgViews, NULLIF(followersRaw, 0)), 0) AS viralityRaw
  FROM base
),

withMax AS (
  SELECT *,
    MAX(viralityRaw) OVER () AS maxVirality,
    MAX(engRate)     OVER () AS maxEng,
    MAX(postsCount)  OVER () AS maxPosts,
    MAX(followersRaw) OVER () AS maxFollowers
  FROM withVirality
),

normalised AS (
  SELECT *,
    LEAST(100, COALESCE(viralityRaw / NULLIF(maxVirality, 0), 0) * 100)  AS vN,
    LEAST(100, COALESCE(engRate     / NULLIF(maxEng, 0),     0) * 100)   AS eN,
    LEAST(100, COALESCE(postsCount  / NULLIF(maxPosts, 0),   0) * 100)   AS fN,
    LEAST(100, COALESCE(followersRaw / NULLIF(maxFollowers, 0), 0) * 100) AS flN
  FROM withMax
),

composite AS (
  SELECT *,
    LEAST(100, GREATEST(0,
      (vN  / 100) * 5   +
      (eN  / 100) * 100 +
      (flN / 100) * 50  +
      (fN  / 100) * 150
    )) AS comp
  FROM normalised
),

curved AS (
  SELECT *,
    50 + SIGN(comp - 50) * POWER(ABS(comp - 50) / 50, 1.3) * 50 AS curvedScore
  FROM composite
)

SELECT
  ROW_NUMBER() OVER (ORDER BY
    CASE WHEN (vN + eN + fN + flN) > 0
      THEN ROUND(LEAST(100, GREATEST(0, GREATEST(curvedScore, 5))))
      ELSE ROUND(LEAST(100, GREATEST(0, curvedScore)))
    END DESC
  )                                                          AS rank,
  name,
  party,
  CAST(ROUND(LEAST(100, GREATEST(0,
    CASE WHEN (vN + eN + fN + flN) > 0
      THEN GREATEST(curvedScore, 5)
      ELSE curvedScore
    END
  ))) AS INT64)                                              AS knoxFactor,
  CAST(ROUND(vN)  AS INT64)                                  AS virality,
  CAST(ROUND(eN)  AS INT64)                                  AS engagement,
  CAST(ROUND(fN)  AS INT64)                                  AS frequency,
  CAST(ROUND(flN) AS INT64)                                  AS followers,
  followersRaw                                               AS totalFollowers,
  CAST(ROUND(avgViews)        AS INT64)                      AS avgViewsPerPost,
  ROUND(viralityRaw, 4)                                      AS viralityRatio,
  ROUND(engRate, 2)                                          AS engRatePct,
  postsCount                                                 AS lifetimePosts
FROM curved
ORDER BY knoxFactor DESC, totalFollowers DESC;
