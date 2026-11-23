/**
 * lib/sharedScores.ts
 * --------------------
 * One Knox Factor per person, whichever index they are seen on.
 *
 * Knox Factor is scored against everyone else on the same index, so a person
 * on two indexes (Andy Burnham, on UK and World Leaders) would otherwise get
 * two different scores. Rule: a person keeps the scores from their HOME index,
 * the lowest dashboard id they are on (UK before World Leaders), on every
 * index. Everyone else is scored as before.
 *
 * The home index's scores are worked out from the same queries and formula
 * the home index uses, per platform, for the same date range, and cached for
 * a while so World Leaders requests do not re-run the UK queries each time.
 * Server-side only.
 *
 * One job: give people on several indexes the same scores everywhere.
 */

import { query } from '@/lib/bigquery';
import { buildAccountsSQL, type Range } from '@/lib/bqQueries';
import { buildXAccountsSQL } from '@/lib/xQueries';
import { transformToPoliticians, type BQAccountRow } from '@/data/transformers';
import { TENANTS, type TenantConfig } from '@/lib/tenants';
import type { Politician } from '@/data/types';

type Platform = 'tiktok' | 'x';
interface HomeScore { scores: Politician['scores']; periodKnoxFactor?: number }
/** personId → that person's scores on one platform of one home index. */
type ScoreMap = Map<string, HomeScore>;

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: Promise<ScoreMap> }>();

/** One platform's scores on one index, for a range. Cached. */
function homeScores(home: TenantConfig, range: Range, platform: Platform): Promise<ScoreMap> {
  const key = `${home.dashboardId}:${range}:${platform}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = (async () => {
    const enabled = platform === 'tiktok' || (home.platforms ?? []).includes('x');
    if (!enabled) return new Map() as ScoreMap;
    const rows = await query<BQAccountRow>(
      platform === 'x' ? buildXAccountsSQL(home.dashboardId, range) : buildAccountsSQL(home.dashboardId, range),
    );
    const map: ScoreMap = new Map();
    for (const p of transformToPoliticians(rows, [], home.grouping.mode, platform)) {
      if (p.personId) map.set(p.personId, { scores: p.scores, periodKnoxFactor: p.periodKnoxFactor });
    }
    return map;
  })();
  // A failed lookup is not kept, so the next request tries again
  value.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Replaces the scores of anyone who is also on a lower-numbered index with
 * their scores there. Call on ONE platform's list, before merging platforms
 * per person, so the merged score matches the home index's merged score.
 */
export async function alignScoresToHome(
  tenant: TenantConfig,
  range: Range,
  platform: Platform,
  politicians: Politician[],
): Promise<Politician[]> {
  const homes = TENANTS.filter(t => t.dashboardId < tenant.dashboardId).sort((a, b) => a.dashboardId - b.dashboardId);
  if (homes.length === 0 || politicians.length === 0) return politicians;

  const maps = await Promise.all(homes.map(h => homeScores(h, range, platform)));
  return politicians.map(p => {
    if (!p.personId) return p;
    const home = maps.map(m => m.get(p.personId!)).find(Boolean);
    if (!home) return p;
    return {
      ...p,
      scores: home.scores,
      periodKnoxFactor: home.periodKnoxFactor,
      platforms: p.platforms?.map(pr => ({ ...pr, knoxFactor: home.scores.knoxFactor })),
    };
  });
}
