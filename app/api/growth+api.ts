/**
 * app/api/growth+api.ts
 * ----------------------
 * Fastest-growing accounts: follower growth over the selected period, per
 * person on the dashboard, TikTok and X added together.
 *
 * GET /api/growth?range=yesterday|week|month|year|lifetime&platform=all|tiktok|x
 *   → { growth: GrowthRow[], growthAbsolute: GrowthRow[] }
 *     growth: largest % growth first; growthAbsolute: most followers gained first
 *
 * Followers come from the account snapshots: TikTok's daily accountMetrics,
 * X's accountMetrics (every few days). Start = the latest snapshot within a
 * few days before the period's first day, end = the latest snapshot. Accounts below
 * MIN_START_FOLLOWERS are left out, so a 40-follower account doubling does
 * not top the list.
 */

import { guardTenant } from '@/lib/tenantGuard';
import { parseRange } from '@/lib/bqQueries';
import { safeErrorDetail } from '@/lib/errors';
import { followerSnapshots, mergeByPerson, type GrowthRow } from '@/lib/followerGrowth';
import { parsePlatformFilter } from '@/lib/platforms';

export type { GrowthRow };

/** Accounts that started below this are left out, so a 40-follower account doubling does not top the list. */
const MIN_START_FOLLOWERS = 1000;
const LIMIT = 20;

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get('range'), 'week');
  const platform = parsePlatformFilter(params.get('platform') ?? 'tiktok');
  const xEnabled = (tenant.platforms ?? []).includes('x');
  const wantTikTok = platform !== 'x';
  const wantX = platform !== 'tiktok' && xEnabled;

  try {
    const rows = await followerSnapshots(tenant.dashboardId, range, { tiktok: wantTikTok, x: wantX });
    const merged = mergeByPerson(rows).filter(g => g.startFollowers >= MIN_START_FOLLOWERS);
    const growth = merged.slice(0, LIMIT);
    const growthAbsolute = [...merged].sort((a, b) => b.gain - a.gain || b.pct - a.pct).slice(0, LIMIT);
    return Response.json(
      { growth, growthAbsolute },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/growth] BigQuery error:', logMessage);
    return Response.json({ error: 'Failed to fetch growth', detail: clientDetail }, { status: 500 });
  }
}
