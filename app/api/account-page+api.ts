/**
 * app/api/account-page+api.ts
 * ----------------------------
 * GET /api/account-page?handle=keirstarmer&range=week
 *
 * Everything the account page (/account/[handle]) renders except post
 * benchmarks, which the page takes from /api/benchmarks.
 *
 * Response: AccountPageApiResponse (see data/account/types.ts)
 */

import { query } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { signMediaFields, signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { dataCacheHeaders } from '@/lib/cacheHeaders';
import { transformToPoliticians } from '@/data/transformers';
import {
  parseRange,
  sanitiseHandle,
  buildAccountsSQL,
  buildAccountPostsSQL,
  buildAccountPagePostsSQL,
  buildLastPostDateSQL,
} from '@/lib/bqQueries';
import { buildComparison, buildPeriod, buildProfile, type BQAccountPagePostRow } from '@/lib/accountPage';
import type { BQAccountRow, BQPostRow } from '@/data/transformers';
import type { AccountPageApiResponse } from '@/data/account/types';

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;
  const dashboardId = tenant.dashboardId;

  const params = new URL(request.url).searchParams;
  const handle = sanitiseHandle(params.get('handle') ?? '');
  const range  = parseRange(params.get('range'), 'week');

  if (!handle) {
    return Response.json({ error: 'Missing handle parameter' }, { status: 400 });
  }

  try {
    // 1. All accounts — normalised scores, peer ranks and group sizes
    // 2. Range posts — feed the scoring transformer, as on /api/account
    // 3. This account's posts in the range and the period before, with tags
    // 4. This account's latest post date, any range
    // 5. All accounts on the Knox Factor inputs from a week ago — scored the
    //    same way, for the profile card's 'vs prev. week' trend
    const [accountRows, rangePostRows, postRows, lastPostRows, weekAgoRows] = await Promise.all([
      query<BQAccountRow>(buildAccountsSQL(dashboardId, range)),
      query<BQPostRow>(buildAccountPostsSQL(dashboardId, handle, range, 5)),
      query<BQAccountPagePostRow>(buildAccountPagePostsSQL(dashboardId, handle, range)),
      query<{ lastPostDate: string | null }>(buildLastPostDateSQL(dashboardId, handle)),
      query<BQAccountRow>(buildAccountsSQL(dashboardId, range, 7)),
    ]);

    const all = transformToPoliticians(accountRows, rangePostRows, tenant.grouping.mode);
    const politician = all.find(p => p.handle.replace(/^@/, '').toLowerCase() === handle);

    if (!politician) {
      return Response.json({ error: `No account found for handle: ${handle}` }, { status: 404 });
    }

    // No metrics row a week ago (e.g. a newly tracked account) → no trend.
    const isTarget = (p: { handle?: string | null; profile?: string | null }) =>
      (p.handle ?? p.profile ?? '').replace(/^@/, '').toLowerCase() === handle;
    const weekAgo = weekAgoRows.find(isTarget)?.totalFollowers
      ? transformToPoliticians(weekAgoRows, [], tenant.grouping.mode).find(isTarget)
      : undefined;

    const period     = buildPeriod(politician, postRows);
    const comparison = buildComparison(politician, all);

    await Promise.all([
      ...period.posts.map(async (post, i) => {
        period.posts[i] = await signMediaFields(post);
      }),
      (async () => {
        if (politician.avatarUrl) politician.avatarUrl = await signGcsUrl(politician.avatarUrl);
      })(),
      ...comparison.map(async row => {
        if (row.avatarUrl) row.avatarUrl = await signGcsUrl(row.avatarUrl);
      }),
    ]);

    const body: AccountPageApiResponse = {
      profile:   buildProfile(politician, all, lastPostRows[0]?.lastPostDate ?? null, weekAgo),
      platforms: ['tiktok'],
      comparison,
      period,
    };

    return Response.json(body, { headers: dataCacheHeaders(tenant) });

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/account-page] error:', logMessage);
    return Response.json(
      { error: 'Failed to load account page', detail: clientDetail },
      { status: 500 }
    );
  }
}
