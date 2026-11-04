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
  growth:  GrowthRow[];
  loading: boolean;
}

export function useGrowth(range: TimeRange = 'week', platform: PlatformFilter = 'tiktok'): GrowthState {
  const [state, setState] = useState<GrowthState>({ growth: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    fetchWithRetry(`/api/growth?range=${range}&platform=${platform}`)
      .then(r => r.json() as Promise<{ growth?: GrowthRow[] }>)
      .then(data => {
        if (!cancelled) setState({ growth: Array.isArray(data.growth) ? data.growth : [], loading: false });
      })
      .catch(() => { if (!cancelled) setState({ growth: [], loading: false }); });

    return () => { cancelled = true; };
  }, [range, platform]);

  return state;
}
