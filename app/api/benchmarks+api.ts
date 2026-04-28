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
 *   engagement — (likes + comments + shares) / views × 100
 *
 * Statistics per metric: min, p25, median, mean, p75, max
 */

import { query, tableRef } from '@/lib/bigquery';
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

const BENCHMARKS_SQL = `
  SELECT
    APPROX_QUANTILES(views, 4)[OFFSET(0)]  AS views_min,
    APPROX_QUANTILES(views, 4)[OFFSET(1)]  AS views_p25,
    APPROX_QUANTILES(views, 4)[OFFSET(2)]  AS views_median,
    AVG(views)                              AS views_mean,
    APPROX_QUANTILES(views, 4)[OFFSET(3)]  AS views_p75,
    APPROX_QUANTILES(views, 4)[OFFSET(4)]  AS views_max,

    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(0)]  AS eng_min,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(1)]  AS eng_p25,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(2)]  AS eng_median,
    AVG(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100
    )              AS eng_mean,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(3)]  AS eng_p75,
    APPROX_QUANTILES(
      SAFE_DIVIDE(CAST(likes + comments + shares AS FLOAT64), views) * 100,
      4
    )[OFFSET(4)]  AS eng_max

  FROM ${tableRef('post')}
  WHERE views > 0
`;

export async function GET(_request: Request): Promise<Response> {
  try {
    const rows = await query<BQBenchmarkRow>(BENCHMARKS_SQL);
    const r = rows[0];

    if (!r) {
      return Response.json({ error: 'No data' }, { status: 404 });
    }

    const benchmarks: PostBenchmarks = {
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

    return Response.json(
      { benchmarks },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/benchmarks] BigQuery error:', logMessage);
    return Response.json({ error: 'Failed to fetch benchmarks', detail: clientDetail }, { status: 500 });
  }
}
