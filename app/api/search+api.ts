/**
 * app/api/search+api.ts
 * ----------------------
 * GET /api/search → SearchIndex (see lib/search.ts)
 *
 * The searchable set for the header search: every account the tenant gate
 * lets this caller read, plus the tenant's groups (parties on The Knox Index,
 * regions on World Leaders). The client filters it locally per keystroke.
 *
 * `locked` mirrors the guest leaderboard's default view: only the top
 * GUEST_OPEN_ROWS by Knox Factor over the week (accounts that posted in range)
 * are open to guests. The flag is the same for every caller, so the response
 * stays CDN-cacheable on public tenants; the client ignores it for signed-in
 * users.
 */

import { query } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { dataCacheHeaders } from '@/lib/cacheHeaders';
import { signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { transformToPoliticians } from '@/data/transformers';
import { buildAccountsSQL } from '@/lib/bqQueries';
import { groupDisplayLabel } from '@/data/grouping';
import { GUEST_OPEN_ROWS } from '@/data/leaderboard';
import type { BQAccountRow } from '@/data/transformers';
import type { SearchIndex, SearchPerson } from '@/lib/search';

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;
  const mode = tenant.grouping.mode;

  try {
    const rows = await query<BQAccountRow>(buildAccountsSQL(tenant.dashboardId, 'week'));
    // Scores come from the account rows; posts only feed recentPosts.
    const politicians = transformToPoliticians(rows, [], mode);

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

    const groups = [...new Set(politicians.map(p => p.groupKey))]
      .filter(key => key !== 'unknown')
      .map(key => ({ key, label: groupDisplayLabel(mode, key) }));

    const body: SearchIndex = { people, groups };
    return Response.json(body, { headers: dataCacheHeaders(tenant) });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/search] error:', logMessage);
    return Response.json({ error: 'Failed to load search index', detail: clientDetail }, { status: 500 });
  }
}
