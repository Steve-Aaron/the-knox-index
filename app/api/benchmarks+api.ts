/**
 * app/api/benchmarks+api.ts
 * --------------------------
 * Returns distribution statistics for views and engagement rate
 * across the full post dataset — used to render box-and-whisker plots.
 *
 * GET /api/benchmarks
 *
 * Metrics:
 *   views      — raw view count per post
 *   engagement — (likes + comments + saves + shares) / views × 100
 *
 * Statistics per metric: min, p25, median, mean, p75, max
 */

import { query, postWeb } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { buildXBenchmarksSQL } from '@/lib/xQueries';
import { safeErrorDetail } from '@/lib/errors';
import type { PostBenchmarks } from '@/data/types';

interface BQBenchmarkRow {
  views_min:    number;
  views_p25:    number;
  views_median: number;
  views_mean:   number;
  views_p75:    number;
  views_max:    number;
  eng_min:      number;
  eng_p25:      number;
  eng_median:   number;
  eng_mean:     number;
  eng_p75:      number;
  eng_max:      number;
}

const BENCHMARKS_SQL = (dashboardId: number) => `
  SELECT
    APPROX_QUANTILES(views, 4)[OFFSET(0)]  AS views_min,
    APPROX_QUANTILES(views, 4)[OFFSET(1)]  AS views_p25,
    APPROX_QUANTILES(views, 4)[OFFSET(2)]  AS views_median,
    AVG(views)                              AS views_mean,
    APPROX_QUANTILES(views, 4)[OFFSET(3)]  AS views_p75,
    APPROX_QUANTILES(views, 4)[OFFSET(4)]  AS views_max,

    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(0)]  AS eng_min,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(1)]  AS eng_p25,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(2)]  AS eng_median,
    AVG(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100
    )              AS eng_mean,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(3)]  AS eng_p75,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + saves + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(4)]  AS eng_max

  FROM ${postWeb(dashboardId)}
  WHERE views > 0
`;

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;

  try {
    const [rows, xRows] = await Promise.all([
      query<BQBenchmarkRow>(BENCHMARKS_SQL(tenant.dashboardId)),
      // Non-essential: a failed X read leaves byPlatform.x null, never a 500.
      query<BQBenchmarkRow>(buildXBenchmarksSQL(tenant.dashboardId)).catch((err: unknown) => {
        console.error('[/api/benchmarks] X benchmarks failed (non-fatal):', safeErrorDetail(err).logMessage);
        return [] as BQBenchmarkRow[];
      }),
    ]);
    const r = rows[0];

    if (!r) {
      return Response.json({ error: 'No data' }, { status: 404 });
    }

    const benchmarks: PostBenchmarks = toBenchmarks(r);
    // Per platform, so an X post is compared with X posts. `benchmarks` stays
    // TikTok for every existing reader.
    const byPlatform = { tiktok: benchmarks, x: xRows[0] ? toBenchmarks(xRows[0]) : null };

    return Response.json(
      { benchmarks, byPlatform },
      { headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/benchmarks] BigQuery error:', logMessage);
    return Response.json({ error: 'Failed to fetch benchmarks', detail: clientDetail }, { status: 500 });
  }
}

function toBenchmarks(r: BQBenchmarkRow): PostBenchmarks {
    return {
      views: {
        min:    Math.round(r.views_min),
        p25:    Math.round(r.views_p25),
        median: Math.round(r.views_median),
        mean:   Math.round(r.views_mean),
        p75:    Math.round(r.views_p75),
        max:    Math.round(r.views_max),
      },
      engagement: {
        min:    +r.eng_min.toFixed(2),
        p25:    +r.eng_p25.toFixed(2),
        median: +r.eng_median.toFixed(2),
        mean:   +r.eng_mean.toFixed(2),
        p75:    +r.eng_p75.toFixed(2),
        max:    +r.eng_max.toFixed(2),
      },
    };
}
