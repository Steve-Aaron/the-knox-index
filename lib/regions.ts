/**
 * lib/regions.ts
 * ---------------
 * Region keys and their labels. Display constants only.
 *
 * The region a given account belongs to is NOT here: that comes from
 * `metadata.person.location.region` in BigQuery, stamped onto each row by the
 * API. This file only says what the buckets are called and in what order they
 * appear, which is a presentation concern.
 *
 * One job: name the regions.
 */

export type RegionKey =
  | 'europe'
  | 'northamerica'
  | 'southamerica'
  | 'africa'
  | 'asia'
  | 'middleeast'
  | 'oceania'
  | 'unknown';

export const REGION_KEYS: readonly RegionKey[] = [
  'europe', 'northamerica', 'southamerica', 'africa', 'asia', 'middleeast', 'oceania', 'unknown',
];

export const REGION_LABELS: Record<RegionKey, string> = {
  europe:       'Europe',
  northamerica: 'North America',
  southamerica: 'South America',
  africa:       'Africa',
  asia:         'Asia',
  middleeast:   'Middle East',
  oceania:      'Oceania',
  unknown:      'Unknown',
};

/** True when the value is a region we know about. */
export function isRegionKey(value: string | null | undefined): value is RegionKey {
  return !!value && (REGION_KEYS as readonly string[]).includes(value);
}
