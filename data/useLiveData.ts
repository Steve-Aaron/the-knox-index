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
        // Do NOT echo the response body into the thrown error — server-side
        // SDK errors have leaked credentials before. We only surface HTTP
        // status to the UI. Operators can read the verbose message in the
        // server logs.
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as { politicians: Politician[] };

      if (!Array.isArray(data.politicians) || data.politicians.length === 0) {
        throw new Error('Empty response');
      }

      setState({ status: 'live', politicians: data.politicians, isLive: true, error: null });

    } catch (err: unknown) {
      // Generic, fixed message in the UI / console. Never includes server detail.
      const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
        ? err.message
        : 'Live data unavailable';
      console.warn('[useLiveData] fetch failed, using mock data');
      setState({
        status:      'error',
        politicians: mockPoliticians,
        isLive:      false,
        error:       uiMessage,
      });
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
