/**
 * data/useBenchmarks.ts
 * ----------------------
 * Fetches distribution benchmarks from /api/benchmarks.
 * Falls back to values derived from mock seed data.
 */
import { useState, useEffect } from 'react';
import type { PostBenchmarks } from './types';

// Derived from mock seed posts:
//   views:  [98K, 187K, 221K, 298K, 412K, 980K, 1.48M, 1.98M, 2.1M]
//   eng %:  [5.0, 6.5, 6.9, 7.5, 9.3, 13.6, 14.7, 14.9, 16.9]
const MOCK_BENCHMARKS: PostBenchmarks = {
  views: {
    min:    98_000,
    p25:    204_000,
    median: 412_000,
    mean:   750_000,
    p75:    1_230_000,
    max:    2_100_000,
  },
  engagement: {
    min:    3.0,
    p25:    6.9,
    median: 9.3,
    mean:   10.5,
    p75:    14.7,
    max:    16.9,
  },
};

export interface BenchmarksState {
  benchmarks: PostBenchmarks;
  loading:    boolean;
  isLive:     boolean;
}

export function useBenchmarks(): BenchmarksState {
  const [state, setState] = useState<BenchmarksState>({
    benchmarks: MOCK_BENCHMARKS,
    loading:    true,
    isLive:     false,
  });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/benchmarks')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ benchmarks: PostBenchmarks }>;
      })
      .then(data => {
        if (!cancelled) {
          setState({ benchmarks: data.benchmarks, loading: false, isLive: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ benchmarks: MOCK_BENCHMARKS, loading: false, isLive: false });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
