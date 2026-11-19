/**
 * app/api/account-page+api.ts
 * ----------------------------
 * GET /api/account-page?handle=keirstarmer&range=week&platform=all
 *
 * `handle` may be a TikTok handle, an X handle or a person slug: all three
 * resolve to the same person, whose TikTok and X accounts are read together.
 * `platform` (all | tiktok | x) picks which of them the page covers; it falls
 * back to 'all' when the person is not on the requested platform.
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
  buildAccountPagePostsSQL,
  buildLastPostDateSQL,
} from '@/lib/bqQueries';
import { buildKeyStats, buildPeriod, buildProfile, type BQAccountPagePostRow } from '@/lib/accountPage';
import type { BQAccountRow } from '@/data/transformers';
import type { AccountPageApiResponse, AccountPlatform, SocialPlatform } from '@/data/account/types';
import { queryParams } from '@/lib/bigquery';
import { buildXAccountsSQL, buildXAccountPagePostsSQL, buildXLastPostDateSQL } from '@/lib/xQueries';
import { signTweetMedia } from '@/lib/xPosts';
import { mergeByPerson } from '@/lib/platformMerge';
import { alignScoresToHome } from '@/lib/sharedScores';
import { parsePlatformFilter } from '@/lib/platforms';
import { followerSnapshots, mergeByPerson as mergeGrowth } from '@/lib/followerGrowth';
import type { Politician } from '@/data/types';

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;
  const dashboardId = tenant.dashboardId;

  const params = new URL(request.url).searchParams;
  const handle = sanitiseHandle(params.get('handle') ?? '');
  const range  = parseRange(params.get('range'), 'week');
  const requested: AccountPlatform = parsePlatformFilter(params.get('platform'));
  const xEnabled = (tenant.platforms ?? []).includes('x');

  if (!handle) {
    return Response.json({ error: 'Missing handle parameter' }, { status: 400 });
  }

  try {
    // 1. Every account on each platform: scores, peer ranks and group sizes.
    //    No recent posts are needed here, so the transformer gets none.
    //    Plus every TikTok account on the Knox Factor inputs from a week ago,
    //    for the profile card's 'vs prev. week' trend.
    const [tiktokRows, xRows, tiktokWeekAgoRows] = await Promise.all([
      query<BQAccountRow>(buildAccountsSQL(dashboardId, range)),
      xEnabled ? query<BQAccountRow>(buildXAccountsSQL(dashboardId, range)) : Promise.resolve([] as BQAccountRow[]),
      query<BQAccountRow>(buildAccountsSQL(dashboardId, range, 7)),
    ]);
    // People also on another index keep their home index's scores (lib/sharedScores.ts)
    const [tiktokAll, xAll] = await Promise.all([
      alignScoresToHome(tenant, range, 'tiktok', transformToPoliticians(tiktokRows, [], tenant.grouping.mode, 'tiktok')),
      alignScoresToHome(tenant, range, 'x',      transformToPoliticians(xRows, [], tenant.grouping.mode, 'x')),
    ]);

    // 2. Who is this? A TikTok handle, an X handle or a person slug.
    const matches = (p: Politician) =>
      p.handle.replace(/^@/, '').toLowerCase() === handle || p.slug === handle;
    const hit = tiktokAll.find(matches) ?? xAll.find(matches);
    if (!hit) {
      return Response.json({ error: `No account found for handle: ${handle}` }, { status: 404 });
    }
    const samePerson = (p: Politician) => hit.personId ? p.personId === hit.personId : p.id === hit.id;
    const tiktokRow = tiktokAll.find(samePerson);
    const xRow      = xAll.find(samePerson);

    const available: SocialPlatform[] = [...(tiktokRow ? ['tiktok' as const] : []), ...(xRow ? ['x' as const] : [])];
    const platform: AccountPlatform =
      requested === 'all' || available.includes(requested) ? requested : 'all';
    const inFilter = (sp: SocialPlatform) => platform === 'all' || platform === sp;

    // 3. The peer set and target for the filter. 'all' merges per person
    //    (lib/platformMerge.ts), so ranks compare people, not accounts.
    const all = platform === 'tiktok' ? tiktokAll : platform === 'x' ? xAll : mergeByPerson(tiktokAll, xAll);
    const politician = all.find(samePerson)!;
    const platformRows = [tiktokRow, xRow].filter((r): r is Politician => !!r && inFilter(r.platform as SocialPlatform));

    // 4. This person's posts in the range and the period before, plus their
    //    latest post date, from each platform in the filter.
    const tiktokHandle = tiktokRow ? sanitiseHandle(tiktokRow.handle) : '';
    const person = { person: hit.personId ?? '' };
    const [tiktokPosts, xPosts, tiktokLast, xLast, snapshots] = await Promise.all([
      tiktokRow && inFilter('tiktok') ? query<BQAccountPagePostRow>(buildAccountPagePostsSQL(dashboardId, tiktokHandle, range)) : [],
      xRow && inFilter('x') ? queryParams<BQAccountPagePostRow>(buildXAccountPagePostsSQL(dashboardId, range), person) : [],
      tiktokRow && inFilter('tiktok') ? query<{ lastPostDate: string | null }>(buildLastPostDateSQL(dashboardId, tiktokHandle)) : [],
      xRow && inFilter('x') ? queryParams<{ lastPostDate: string | null }>(buildXLastPostDateSQL(dashboardId), person) : [],
      followerSnapshots(dashboardId, range, { tiktok: !!tiktokRow && inFilter('tiktok'), x: !!xRow && inFilter('x') }),
    ]);
    const lastPostDate = [tiktokLast[0]?.lastPostDate, xLast[0]?.lastPostDate].filter(Boolean).sort().pop() ?? null;

    const period = buildPeriod(politician, [...tiktokPosts, ...xPosts], platformRows);

    // Followers gained: this person's accounts in the filter, added together
    const ownIds = new Set(platformRows.map(r => String(r.id)));
    const growth = mergeGrowth(snapshots.filter(r => (hit.personId && r.personId === hit.personId) || ownIds.has(String(r.accountId))))[0];
    period.followerGrowth = growth ? { gained: growth.gain, pct: growth.pct, since: growth.since } : null;

    const keyStats = buildKeyStats(politician, all, tenant.grouping.mode, range !== 'lifetime');

    // Knox Factor trend vs a week ago. Only TikTok has the dated inputs, so
    // the trend shows only when the score on the card is the TikTok one. It
    // is the change on this index's own scoring, so a person whose score
    // comes from their home index (lib/sharedScores.ts) still gets a fair
    // trend. No metrics row a week ago (a newly tracked account) → no trend.
    let knoxDeltaVsPrev: number | null = null;
    if (tiktokRow && (platform === 'tiktok' || (platform === 'all' && !xRow))) {
      const isTarget = (r: BQAccountRow) => String(r.id) === String(tiktokRow.id);
      if (tiktokWeekAgoRows.find(isTarget)?.totalFollowers) {
        const scoreOf = (rows: BQAccountRow[]) =>
          transformToPoliticians(rows, [], tenant.grouping.mode, 'tiktok').find(p => String(p.id) === String(tiktokRow.id))?.scores.knoxFactor;
        const now = scoreOf(tiktokRows);
        const before = scoreOf(tiktokWeekAgoRows);
        if (now != null && before != null) knoxDeltaVsPrev = now - before;
      }
    }

    await Promise.all([
      ...period.posts.map(async (post, i) => {
        period.posts[i] = await signMediaFields(post);
        await signTweetMedia(period.posts[i].tweet);
      }),
      (async () => {
        if (politician.avatarUrl) politician.avatarUrl = await signGcsUrl(politician.avatarUrl);
      })(),
      ...keyStats.flatMap(k => k.neighbours).map(async row => {
        if (row.avatarUrl) row.avatarUrl = await signGcsUrl(row.avatarUrl);
      }),
    ]);

    const body: AccountPageApiResponse = {
      profile:   buildProfile(politician, all, lastPostDate, knoxDeltaVsPrev),
      platforms: available,
      keyStats,
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
