import { useEffect, useState } from 'react';
import { fetchWithRetry } from '@/data/fetchWithRetry';
import { useBenchmarks } from '@/data/useBenchmarks';
import type { AccountPageApiResponse, AccountPageData, AccountPlatform, TimeRange } from './types';

/**
 * useAccountPage
 * ---------------
 * Single data entry point for the account page: /api/account-page for the
 * account, /api/benchmarks for the post distributions. The last loaded data
 * stays on screen while a new range loads.
 *
 * `platform` is accepted for when X lands; today the API only has TikTok,
 * so it does not change the request.
 *
 * One job: give the page an AccountPageData for the current filters.
 */
export interface AccountPageState {
  data:     AccountPageData | null;
  loading:  boolean;
  error:    string | null;
  /** The handle does not exist on this dashboard (HTTP 404). */
  notFound: boolean;
}

export function useAccountPage(
  handle: string | undefined,
  range: TimeRange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  platform: AccountPlatform,
): AccountPageState {
  const { benchmarks } = useBenchmarks();
  const [account, setAccount] = useState<AccountPageApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ handle: handle.replace(/^@/, ''), range });
    fetchWithRetry(`/api/account-page?${params.toString()}`)
      .then(res => res.json() as Promise<AccountPageApiResponse>)
      .then(body => {
        if (!cancelled) { setNotFound(false); setAccount(body); }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // fetchWithRetry throws 'HTTP 404' rather than returning the response.
        if (err instanceof Error && err.message === 'HTTP 404') {
          setNotFound(true);
          setAccount(null);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load account');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [handle, range]);

  return {
    data: account ? { ...account, postBenchmarks: benchmarks } : null,
    loading,
    error,
    notFound,
  };
}
