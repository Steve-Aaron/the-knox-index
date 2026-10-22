import { useMemo } from 'react';
import { getMockAccountPage } from './mockAccount';
import type { AccountPageData, AccountPlatform, TimeRange } from './types';

/**
 * useAccountPage
 * ---------------
 * Single data entry point for the account page. Today it returns mock data
 * synchronously; when the API lands, swap the body for a fetchWithRetry call
 * (profile keyed on handle, period keyed on handle + range + platform) and
 * keep the return shape so no component has to change.
 *
 * One job: give the page an AccountPageData for the current filters.
 */
export interface AccountPageState {
  data:    AccountPageData | null;
  loading: boolean;
  error:   string | null;
}

export function useAccountPage(
  handle: string | undefined,
  range: TimeRange,
  platform: AccountPlatform,
): AccountPageState {
  return useMemo<AccountPageState>(() => {
    if (!handle) return { data: null, loading: false, error: 'Missing handle' };
    return { data: getMockAccountPage(handle, range, platform), loading: false, error: null };
  }, [handle, range, platform]);
}
