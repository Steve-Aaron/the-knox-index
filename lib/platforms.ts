/**
 * lib/platforms.ts
 * -----------------
 * The page-level platform filter: which social platform(s) a dashboard read
 * covers. Isomorphic — the API parses it, the client renders the chips.
 *
 * Reuses the account page's AccountPlatform type so the dashboard and the
 * account page share one vocabulary ('all' | 'tiktok' | 'x').
 *
 * One job: name the platforms and parse the filter.
 */

import type { AccountPlatform, SocialPlatform } from '@/data/account/types';

export type PlatformFilter = AccountPlatform;
export type { SocialPlatform };

export const PLATFORM_FILTERS: readonly PlatformFilter[] = ['all', 'tiktok', 'x'];

export const PLATFORM_FILTER_LABELS: Record<PlatformFilter, string> = {
  all:    'All platforms',
  tiktok: 'TikTok',
  x:      'X',
};

/** Profile URL for a handle on a platform. */
export function profileUrlFor(platform: SocialPlatform, handle: string): string {
  const h = handle.replace(/^@/, '');
  return platform === 'x' ? `https://x.com/${h}` : `https://www.tiktok.com/@${h}`;
}

export function parsePlatformFilter(raw: string | null | undefined): PlatformFilter {
  return PLATFORM_FILTERS.includes(raw as PlatformFilter) ? (raw as PlatformFilter) : 'all';
}

/** The platforms a filter value reads from. */
export function platformsFor(filter: PlatformFilter): SocialPlatform[] {
  return filter === 'all' ? ['tiktok', 'x'] : [filter];
}
