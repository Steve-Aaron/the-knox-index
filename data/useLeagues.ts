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

export interface TagCount { label: string; count: number }

interface LeaguesState {
  styles:  TagCount[];
  topics:  TagCount[];
  loading: boolean;
}

export function useLeagues(range: TimeRange = 'week'): LeaguesState {
  const [state, setState] = useState<LeaguesState>({ styles: [], topics: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    fetchWithRetry(`/api/leagues?range=${range}`)
      .then(r => r.json() as Promise<{ styles?: TagCount[]; topics?: TagCount[] }>)
      .then(data => {
        if (cancelled) return;
        setState({
          styles:  Array.isArray(data.styles) ? data.styles : [],
          topics:  Array.isArray(data.topics) ? data.topics : [],
          loading: false,
        });
      })
      .catch(() => { if (!cancelled) setState({ styles: [], topics: [], loading: false }); });

    return () => { cancelled = true; };
  }, [range]);

  return state;
}
