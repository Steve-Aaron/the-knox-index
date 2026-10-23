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
import { transformToPoliticians } from '@/data/transformers';
import {
  parseRange,
  sanitiseHandle,
  buildAccountsSQL,
  buildAccountPostsSQL,
  buildAccountPagePostsSQL,
  buildLastPostDateSQL,
} from '@/lib/bqQueries';
import { buildKeyStats, buildPeriod, buildProfile, type BQAccountPagePostRow } from '@/lib/accountPage';
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
    const [accountRows, rangePostRows, postRows, lastPostRows] = await Promise.all([
      query<BQAccountRow>(buildAccountsSQL(dashboardId, range)),
      query<BQPostRow>(buildAccountPostsSQL(dashboardId, handle, range, 5)),
      query<BQAccountPagePostRow>(buildAccountPagePostsSQL(dashboardId, handle, range)),
      query<{ lastPostDate: string | null }>(buildLastPostDateSQL(dashboardId, handle)),
    ]);

    const all = transformToPoliticians(accountRows, rangePostRows, tenant.grouping.mode);
    const politician = all.find(p => p.handle.replace(/^@/, '').toLowerCase() === handle);

    if (!politician) {
      return Response.json({ error: `No account found for handle: ${handle}` }, { status: 404 });
    }

    const period = buildPeriod(politician, postRows);

    await Promise.all([
      ...period.posts.map(async (post, i) => {
        period.posts[i] = await signMediaFields(post);
      }),
      (async () => {
        if (politician.avatarUrl) politician.avatarUrl = await signGcsUrl(politician.avatarUrl);
      })(),
    ]);

    const body: AccountPageApiResponse = {
      profile:   buildProfile(politician, all, lastPostRows[0]?.lastPostDate ?? null),
      platforms: ['tiktok'],
      keyStats:  buildKeyStats(politician, all, tenant.grouping.mode),
      period,
    };

    return Response.json(body, {
      headers: { 'Cache-Control': 'private, max-age=900, stale-while-revalidate=120' },
    });

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/account-page] error:', logMessage);
    return Response.json(
      { error: 'Failed to load account page', detail: clientDetail },
      { status: 500 }
    );
  }
}
