/**
 * data/useLiveData.ts
 * --------------------
 * React hook that fetches live Politician data from the /api/ariadne route.
 * Retries up to 3 times (1 s → 2 s → 4 s) before surfacing an error.
 * Exposes retryAttempt so the UI can show 'Retrying 1/3…' during back-off.
 * Fires Area 2 Mixpanel events: data_loaded / data_load_failed with timing.
 * Never falls back to mock data — errors surface as status: 'error' with an
 * empty politicians array so the UI can render a proper error state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Politician } from './types';
import { fetchWithRetry } from './fetchWithRetry';
import { track, startTimer, stopTimer } from '@/lib/analytics';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

export interface DataState {
  status:        'loading' | 'live' | 'error';
  politicians:   Politician[];
  /** Count of fully-processed posts in our post table (videoSummary + videoMp4 present). */
  totalPostsInDb: number;
  isLive:        boolean;
  error:         string | null;
  /** Current retry attempt (1-based), or 0 when not retrying. */
  retryAttempt:  number;
  /** Total retry attempts before giving up (mirrors fetchWithRetry delays length). */
  retryTotal:    number;
  /**
   * True only during the very first fetch — used to show the full-page
   * LoadingScreen overlay. Subsequent range-change fetches set this false so
   * the UI shows skeleton columns rather than an overlay.
   */
  isInitialLoad: boolean;
}

const API_PATH    = '/api/ariadne';
const RETRY_TOTAL = 3;
const TIMER_KEY   = 'data_load';

export function useLiveData(range: TimeRange = 'yesterday'): DataState & { refresh: () => void } {
  const [state, setState] = useState<DataState>({
    status:         'loading',
    politicians:    [],
    totalPostsInDb: 0,
    isLive:         false,
    error:          null,
    retryAttempt:   0,
    retryTotal:     RETRY_TOTAL,
    isInitialLoad:  true,
  });

  const cancelledRef   = useRef(false);
  const retryCountRef  = useRef(0);
  /** Flipped to false after the first successful response. */
  const everLoadedRef  = useRef(false);

  const fetch_ = useCallback(async () => {
    cancelledRef.current  = false;
    retryCountRef.current = 0;

    // Clear stale data immediately — the UI should show skeletons, not old data,
    // while the new range is fetching. isInitialLoad stays true only before the
    // first ever successful load (controls full-page overlay vs. skeleton columns).
    setState(prev => ({
      ...prev,
      status:         'loading',
      politicians:    [],
      totalPostsInDb: 0,
      isLive:         false,
      error:          null,
      retryAttempt:   0,
      isInitialLoad:  !everLoadedRef.current,
    }));

    startTimer(TIMER_KEY);

    try {
      const res = await fetchWithRetry(
        `${API_PATH}?range=${range}`,
        undefined,
        undefined,
        ({ attempt, total }) => {
          retryCountRef.current = attempt;
          if (!cancelledRef.current) {
            setState(prev => ({ ...prev, retryAttempt: attempt, retryTotal: total }));
          }
        },
      );

      if (cancelledRef.current) return;

      const data = await res.json() as { politicians: Politician[]; totalPostsInDb?: number };

      if (!Array.isArray(data.politicians) || data.politicians.length === 0) {
        throw new Error('Empty response');
      }

      const loadMs = stopTimer(TIMER_KEY);
      everLoadedRef.current = true;

      track('data_loaded', {
        time_to_load_ms:  loadMs,
        politician_count: data.politicians.length,
        retry_count:      retryCountRef.current,
      });

      setState({
        status:         'live',
        politicians:    data.politicians,
        totalPostsInDb: typeof data.totalPostsInDb === 'number' ? data.totalPostsInDb : 0,
        isLive:         true,
        error:          null,
        retryAttempt:   0,
        retryTotal:     RETRY_TOTAL,
        isInitialLoad:  false,
      });

    } catch (err: unknown) {
      if (cancelledRef.current) return;

      const loadMs = stopTimer(TIMER_KEY);
      const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
        ? err.message
        : 'Live data unavailable';

      track('data_load_failed', {
        time_to_fail_ms: loadMs,
        retry_count:     retryCountRef.current,
        error:           uiMessage,
      });

      setState({
        status:         'error',
        politicians:    [],
        totalPostsInDb: 0,
        isLive:         false,
        error:          uiMessage,
        retryAttempt:   0,
        retryTotal:     RETRY_TOTAL,
        isInitialLoad:  false,
      });
    }
  }, [range]);

  useEffect(() => {
    fetch_();
    return () => { cancelledRef.current = true; };
  }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
