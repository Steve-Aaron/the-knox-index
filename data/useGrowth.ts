/**
 * data/useGrowth.ts
 * ------------------
 * Fetches the fastest-growing accounts (follower growth) from /api/growth for
 * the selected range and platform. Fails soft: on error it returns an empty
 * list and the card shows its empty state.
 *
 * One job: give the Fastest growing card its rows.
 */

import { useEffect, useState } from 'react';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import type { PlatformFilter } from '@/lib/platforms';
import { fetchWithRetry } from './fetchWithRetry';

export interface GrowthRow {
  key:            string;
  personId:       string | null;
  accountIds:     string[];
  platforms:      ('tiktok' | 'x')[];
  startFollowers: number;
  endFollowers:   number;
  gain:           number;
  pct:            number;
  since:          string;
}

interface GrowthState {
  /** Largest % growth first. */
  growth:         GrowthRow[];
  /** Most followers gained first. */
  growthAbsolute: GrowthRow[];
  loading:        boolean;
}

export function useGrowth(range: TimeRange = 'week', platform: PlatformFilter = 'tiktok'): GrowthState {
  const [state, setState] = useState<GrowthState>({ growth: [], growthAbsolute: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    fetchWithRetry(`/api/growth?range=${range}&platform=${platform}`)
      .then(r => r.json() as Promise<{ growth?: GrowthRow[]; growthAbsolute?: GrowthRow[] }>)
      .then(data => {
        if (!cancelled) setState({
          growth:         Array.isArray(data.growth) ? data.growth : [],
          growthAbsolute: Array.isArray(data.growthAbsolute) ? data.growthAbsolute : [],
          loading:        false,
        });
      })
      .catch(() => { if (!cancelled) setState({ growth: [], growthAbsolute: [], loading: false }); });

    return () => { cancelled = true; };
  }, [range, platform]);

  return state;
}
