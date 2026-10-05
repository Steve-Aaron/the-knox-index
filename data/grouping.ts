/**
 * data/grouping.ts
 * -----------------
 * How a tenant buckets its accounts: by party (The Knox Index) or by region
 * (World Leaders). Isomorphic — the server stamps each row's group, the client
 * renders filters and the group leaderboard from the same rules.
 *
 * One job: turn an account into its grouping key and label for a tenant.
 */

import { toPartyKeyPublic } from '@/data/partyUtils';
import { REGION_LABELS, REGION_KEYS, isRegionKey, type RegionKey } from '@/lib/regions';
import type { GroupingMode } from '@/lib/tenants';
import type { GroupKey } from '@/theme/colors';

export interface GroupSource {
  /** Raw `account.party` value from BigQuery. */
  party?:  string | null;
  /** Region key from `metadata.person.location.region`, stamped on by the API. */
  region?: string | null;
}

/** The colour + grouping key for this account under the tenant's mode. */
export function groupKeyFor(mode: GroupingMode, src: GroupSource): GroupKey {
  if (mode !== 'region') return toPartyKeyPublic(src.party);
  return isRegionKey(src.region) ? src.region : 'unknown';
}

/** Title-case a raw party string: 'liberal_democrats' → 'Liberal Democrats'. */
function prettyParty(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Human label for the group shown beside an account. */
export function groupLabelFor(mode: GroupingMode, src: GroupSource): string {
  if (mode !== 'region') return prettyParty(src.party);
  return REGION_LABELS[isRegionKey(src.region) ? src.region : 'unknown'];
}

/** Every key the group filter can take, in display order. */
export function groupKeysFor(mode: GroupingMode): readonly GroupKey[] {
  return mode === 'region' ? (REGION_KEYS as readonly GroupKey[]) : [];
}

/** Label for a bare key — used by filter chips that only hold the key. */
export function labelForGroupKey(mode: GroupingMode, key: string): string {
  if (mode === 'region') return REGION_LABELS[key as RegionKey] ?? 'Unknown';
  return prettyParty(key);
}

/**
 * Is this group filtered in the warehouse rather than by party spelling?
 * Region mode filters on `metadata.person.location.region`, so the API adds a
 * predicate instead of expanding the group into a handle list.
 */
export function isWarehouseGroup(mode: GroupingMode): boolean {
  return mode === 'region';
}
