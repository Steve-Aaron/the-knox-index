/**
 * data/useBenchmarks.ts
 * ----------------------
 * Fetches distribution benchmarks from /api/benchmarks.
 * Retries up to 3 times (1 s → 2 s → 4 s) before surfacing an error.
 * Never falls back to mock data — on failure, benchmarks is null and
 * consumers (BoxWhisker) simply render nothing.
 */
import { useState, useEffect, useRef } from 'react';
import type { PostBenchmarks } from './types';
import { fetchWithRetry } from './fetchWithRetry';

export interface BenchmarksState {
  benchmarks: PostBenchmarks | null;
  loading:    boolean;
  error:      string | null;
  isLive:     boolean;
}

export function useBenchmarks(): BenchmarksState {
  const [state, setState] = useState<BenchmarksState>({
    benchmarks: null,
    loading:    true,
    error:      null,
    isLive:     false,
  });

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    fetchWithRetry('/api/benchmarks')
      .then(r => r.json() as Promise<{ benchmarks: PostBenchmarks }>)
      .then(data => {
        if (!cancelledRef.current) {
          setState({ benchmarks: data.benchmarks, loading: false, error: null, isLive: true });
        }
      })
      .catch((err: unknown) => {
        if (!cancelledRef.current) {
          const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
            ? err.message
            : 'Benchmarks unavailable';
          setState({ benchmarks: null, loading: false, error: uiMessage, isLive: false });
        }
      });

    return () => { cancelledRef.current = true; };
  }, []);

  return state;
}
