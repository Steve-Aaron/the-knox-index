/**
 * app/api/search+api.ts
 * ----------------------
 * GET /api/search → SearchIndex (see lib/search.ts)
 *
 * The searchable set for the header search: every account the tenant gate
 * lets this caller read, plus the tenant's groups (parties on The Knox Index,
 * regions on World Leaders). The client filters it locally per keystroke.
 *
 * `locked` mirrors the guest leaderboard: only the top 5 by Knox Factor over
 * the default week (accounts that posted in range) are open to guests. The
 * flag is the same for every caller, so the response stays CDN-cacheable on
 * public tenants; the client ignores it for signed-in users.
 */

import { query } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { dataCacheHeaders } from '@/lib/cacheHeaders';
import { signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { transformToPoliticians } from '@/data/transformers';
import { buildAccountsSQL } from '@/lib/bqQueries';
import { PARTY_DISPLAY_LABELS } from '@/data/grouping';
import type { BQAccountRow } from '@/data/transformers';
import type { GroupKey } from '@/theme/colors';
import type { SearchGroup, SearchIndex, SearchPerson } from '@/lib/search';

/** Guests see this many leaderboard rows unlocked — matches RankBoard. */
const GUEST_OPEN_ROWS = 5;

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;

  try {
    const rows = await query<BQAccountRow>(buildAccountsSQL(tenant.dashboardId, 'week'));
    // Scores come from the account rows; posts only feed recentPosts.
    const politicians = transformToPoliticians(rows, [], tenant.grouping.mode);

    const open = new Set(
      politicians
        .filter(p => p.totals.postsInRange > 0)
        .sort((a, b) => b.scores.knoxFactor - a.scores.knoxFactor)
        .slice(0, GUEST_OPEN_ROWS)
        .map(p => p.id),
    );

    const people: SearchPerson[] = await Promise.all(politicians.map(async p => ({
      id:             p.id,
      name:           p.name,
      handle:         p.handle.replace(/^@+/, ''),
      groupKey:       p.groupKey,
      partyLabel:     p.partyLabel,
      avatarInitials: p.avatarInitials,
      avatarUrl:      p.avatarUrl ? await signGcsUrl(p.avatarUrl) : undefined,
      locked:         !open.has(p.id),
    })));

    // One entry per group key: a party by its display name, a region (or an
    // unmapped party) by its members' most common label.
    const labelCounts = new Map<GroupKey, Map<string, number>>();
    for (const p of politicians) {
      if (p.groupKey === 'unknown') continue;
      const counts = labelCounts.get(p.groupKey) ?? new Map<string, number>();
      counts.set(p.groupLabel, (counts.get(p.groupLabel) ?? 0) + 1);
      labelCounts.set(p.groupKey, counts);
    }
    const groups: SearchGroup[] = [...labelCounts].map(([key, counts]) => ({
      key,
      label: (tenant.grouping.mode === 'party' ? PARTY_DISPLAY_LABELS[key] : undefined)
        ?? [...counts].sort((a, b) => b[1] - a[1])[0][0],
    }));

    const body: SearchIndex = { people, groups };
    return Response.json(body, { headers: dataCacheHeaders(tenant) });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/search] error:', logMessage);
    return Response.json({ error: 'Failed to load search index', detail: clientDetail }, { status: 500 });
  }
}
