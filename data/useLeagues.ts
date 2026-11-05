/**
 * data/useLeagues.ts
 * -------------------
 * Fetches whole-range style + topic counts from /api/leagues for the selected
 * range, so the Style League and Topic Cloud reflect every post in range
 * rather than the paginated feed.
 *
 * Refetches whenever `range` changes. Fails soft: on error it returns empty
 * arrays, and the consuming components fall back to counting the loaded feed.
 */

import { useState, useEffect } from 'react';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import { fetchWithRetry } from './fetchWithRetry';
import type { PlatformFilter } from '@/lib/platforms';
import type { RisingTopic } from '@/lib/rising';

export interface TagCount { label: string; count: number }

interface LeaguesState {
  styles:  TagCount[];
  topics:  TagCount[];
  /** Fastest-growing topics vs the period before; null on lifetime. */
  rising:  RisingTopic[] | null;
  /** Topics whose average views per post rose most vs the period before; null on lifetime. */
  risingImpact: RisingTopic[] | null;
  loading: boolean;
}

export function useLeagues(range: TimeRange = 'week', platform: PlatformFilter = 'tiktok'): LeaguesState {
  const [state, setState] = useState<LeaguesState>({ styles: [], topics: [], rising: null, risingImpact: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    fetchWithRetry(`/api/leagues?range=${range}&platform=${platform}`)
      .then(r => r.json() as Promise<{ styles?: TagCount[]; topics?: TagCount[]; rising?: RisingTopic[] | null; risingImpact?: RisingTopic[] | null }>)
      .then(data => {
        if (cancelled) return;
        setState({
          styles:  Array.isArray(data.styles) ? data.styles : [],
          topics:  Array.isArray(data.topics) ? data.topics : [],
          rising:  Array.isArray(data.rising) ? data.rising : null,
          risingImpact: Array.isArray(data.risingImpact) ? data.risingImpact : null,
          loading: false,
        });
      })
      .catch(() => { if (!cancelled) setState({ styles: [], topics: [], rising: null, risingImpact: null, loading: false }); });

    return () => { cancelled = true; };
  }, [range, platform]);

  return state;
}
