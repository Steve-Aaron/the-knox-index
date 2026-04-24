/**
 * data/useLiveData.ts
 * --------------------
 * React hook that fetches live Politician data from the /api/ariadne route.
 * Falls back to mock data if the fetch fails (dev safety net).
 * Returns { politicians, loading, error, isLive }.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Politician } from './types';
import { politicians as mockPoliticians } from './politicians';

export interface DataState {
  status:      'loading' | 'live' | 'error';
  politicians: Politician[];
  isLive:      boolean;
  error:       string | null;
}

const API_PATH = '/api/ariadne';

export function useLiveData(): DataState & { refresh: () => void } {
  const [state, setState] = useState<DataState>({
    status:      'loading',
    politicians: [],   // start empty — skeletons shown until real data arrives
    isLive:      false,
    error:       null,
  });

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', isLive: false, error: null }));

    try {
      const res = await fetch(API_PATH);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { politicians: Politician[] };

      if (!Array.isArray(data.politicians) || data.politicians.length === 0) {
        throw new Error('Empty response — falling back to mock data');
      }

      setState({ status: 'live', politicians: data.politicians, isLive: true, error: null });


    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[useLiveData] fetch failed, using mock data:', message);
      setState({
        status:      'error',
        politicians: mockPoliticians,
        isLive:      false,
        error:       message,
      });
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
