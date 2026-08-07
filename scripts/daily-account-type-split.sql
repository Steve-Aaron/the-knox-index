-- Daily post/engagement split by account type, gated to the public dashboard.
-- Gate: account_x_dashboard -> dashboard, keeping only dashboard.id = 1 AND dashboard.isPublic = TRUE.
-- Schema verified live 2026-07-24:
--   account_x_dashboard(accountId STRING, dashboardId INT64)
--   dashboard(id INT64, name STRING, isPublic BOOL, isActive BOOL, description STRING)
--   account.id is INT64, so the junction join needs CAST(a.id AS STRING).
--   post.profile has no '@' prefix (0 of 44,130 rows); account.profile always has it (443 of 443),
--   so CONCAT('@', p.profile) is correct; LOWER() on both sides guards against case drift.

WITH dashboard_accounts AS (
  -- The gate: one row per account that belongs to the public Knox Index dashboard
  SELECT DISTINCT d.accountId
  FROM `project-ariadne.ariadne_tiktok_demo.account_x_dashboard` d
  JOIN `project-ariadne.ariadne_tiktok_demo.dashboard` db
    ON d.dashboardId = db.id
  WHERE db.id = 1
    AND db.isPublic = TRUE
),
account_type_map AS (
  -- Collapse many-to-many account types into ONE row per gated account.
  -- NOTE: ANY_VALUE picks an arbitrary type for multi-type accounts (e.g. a party
  -- leader who is also an MP); replace with a priority pick if that matters.
  SELECT
    a.id AS accountId,
    ANY_VALUE(atype.name) AS account_type
  FROM `project-ariadne.ariadne_tiktok_demo.account` a
  JOIN dashboard_accounts da
    ON CAST(a.id AS STRING) = da.accountId
  LEFT JOIN `project-ariadne.ariadne_tiktok_demo.account_x_accountType` axt
    ON a.id = axt.accountId
  LEFT JOIN `project-ariadne.ariadne_tiktok_demo.accountType` atype
    ON axt.accountTypeId = atype.id
  GROUP BY a.id
),
base AS (
  -- INNER joins so ungated posts cannot leak into the totals baseline
  SELECT
    p.*,
    atm.account_type
  FROM `project-ariadne.ariadne_tiktok_demo.post` p
  JOIN `project-ariadne.ariadne_tiktok_demo.account` a
    ON LOWER(CONCAT('@', p.profile)) = LOWER(a.profile)
  JOIN dashboard_accounts da
    ON CAST(a.id AS STRING) = da.accountId
  LEFT JOIN account_type_map atm
    ON a.id = atm.accountId
  WHERE p.postDate = "2026-07-23"
)
SELECT
  -- =====================
  -- MPs
  -- =====================
  COUNT(DISTINCT IF(account_type = 'member_of_parliament', postId, NULL)) AS mp_posts,
  COUNT(DISTINCT IF(account_type = 'member_of_parliament', profile, NULL)) AS mp_accounts,
  SUM(IF(account_type = 'member_of_parliament', COALESCE(views, 0), 0)) AS mp_views,
  (
    SUM(IF(account_type = 'member_of_parliament', COALESCE(likes, 0), 0)) +
    SUM(IF(account_type = 'member_of_parliament', COALESCE(comments, 0), 0)) +
    SUM(IF(account_type = 'member_of_parliament', COALESCE(shares, 0), 0)) +
    SUM(IF(account_type = 'member_of_parliament', COALESCE(reposts, 0), 0)) +
    SUM(IF(account_type = 'member_of_parliament', COALESCE(saves, 0), 0))
  ) AS mp_interactions,
  ROUND(
    100 *
    (
      SUM(IF(account_type = 'member_of_parliament', COALESCE(likes, 0), 0)) +
      SUM(IF(account_type = 'member_of_parliament', COALESCE(comments, 0), 0)) +
      SUM(IF(account_type = 'member_of_parliament', COALESCE(shares, 0), 0)) +
      SUM(IF(account_type = 'member_of_parliament', COALESCE(reposts, 0), 0)) +
      SUM(IF(account_type = 'member_of_parliament', COALESCE(saves, 0), 0))
    )
    / NULLIF(SUM(IF(account_type = 'member_of_parliament', COALESCE(views, 0), 0)), 0),
    2
  ) AS mp_engagement_rate,
  -- =====================
  -- Political Parties
  -- =====================
  COUNT(DISTINCT IF(account_type = 'political_party', postId, NULL)) AS party_posts,
  COUNT(DISTINCT IF(account_type = 'political_party', profile, NULL)) AS party_accounts,
  SUM(IF(account_type = 'political_party', COALESCE(views, 0), 0)) AS party_views,
  (
    SUM(IF(account_type = 'political_party', COALESCE(likes, 0), 0)) +
    SUM(IF(account_type = 'political_party', COALESCE(comments, 0), 0)) +
    SUM(IF(account_type = 'political_party', COALESCE(shares, 0), 0)) +
    SUM(IF(account_type = 'political_party', COALESCE(reposts, 0), 0)) +
    SUM(IF(account_type = 'political_party', COALESCE(saves, 0), 0))
  ) AS party_interactions,
  ROUND(
    100 *
    (
      SUM(IF(account_type = 'political_party', COALESCE(likes, 0), 0)) +
      SUM(IF(account_type = 'political_party', COALESCE(comments, 0), 0)) +
      SUM(IF(account_type = 'political_party', COALESCE(shares, 0), 0)) +
      SUM(IF(account_type = 'political_party', COALESCE(reposts, 0), 0)) +
      SUM(IF(account_type = 'political_party', COALESCE(saves, 0), 0))
    )
    / NULLIF(SUM(IF(account_type = 'political_party', COALESCE(views, 0), 0)), 0),
    2
  ) AS party_engagement_rate,
  -- =====================
  -- TOTAL (gated baseline)
  -- =====================
  COUNT(DISTINCT postId) AS total_posts,
  COUNT(DISTINCT profile) AS total_accounts,
  SUM(COALESCE(views, 0)) AS total_views,
  (
    SUM(COALESCE(likes, 0)) +
    SUM(COALESCE(comments, 0)) +
    SUM(COALESCE(shares, 0)) +
    SUM(COALESCE(reposts, 0)) +
    SUM(COALESCE(saves, 0))
  ) AS total_interactions,
  ROUND(
    100 *
    (
      SUM(COALESCE(likes, 0)) +
      SUM(COALESCE(comments, 0)) +
      SUM(COALESCE(shares, 0)) +
      SUM(COALESCE(reposts, 0)) +
      SUM(COALESCE(saves, 0))
    )
    / NULLIF(SUM(COALESCE(views, 0)), 0),
    2
  ) AS total_engagement_rate
FROM base;
