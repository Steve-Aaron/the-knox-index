/**
 * data/usePostsData.ts
 * ----------------------
 * Fetches posts from /api/posts with SERVER-SIDE PAGINATION. The query is
 * ordered server-side by `sortKey`; we pull one page at a time (PAGE_SIZE) and
 * accumulate, so the user can walk the entire ordered set via loadMore() without
 * the API ever signing/shipping the whole dataset in one request.
 *
 * Retries up to 3 times (1 s → 2 s → 4 s) before surfacing an error. Never falls
 * back to mock data — errors surface with the posts loaded so far.
 *
 * Why sortKey is server-side: with lifetime ranges spanning thousands of posts,
 * a date-priority sort + page window means high-view-but-old posts still surface
 * because the ORDER BY runs in BigQuery before the page is sliced.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { PostRecord } from './types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import { fetchWithRetry } from './fetchWithRetry';

/** Sort keys supported by /api/posts — must match the API's whitelist. */
export type PostsSortKey = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'virality' | 'postDate';

/** Posts fetched per page. Bounded so each request signs a small batch of URLs. */
const PAGE_SIZE = 200;

export interface PostsState {
  posts:       PostRecord[];
  /** True during the initial (page 0) load only. */
  loading:     boolean;
  /** True while appending a further page via loadMore(). */
  loadingMore: boolean;
  error:       string | null;
  isLive:      boolean;
  /** Whether another page is available on the server. */
  hasMore:     boolean;
  /** Total matching rows for the current filters/range (null until first load). */
  total:       number | null;
}

/**
 * Convert a TimeRange key to its `since` / `until` ISO dates (inclusive), or
 * nulls for lifetime. Calendar periods in UTC, matching rangeDateFilter() in
 * lib/bqQueries.ts: yesterday only, this week from Monday, this month from
 * the 1st, this year from 1 January.
 */
function rangeToWindow(range: TimeRange): { since: string | null; until: string | null } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const iso = (day: number, month = m, year = y) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  switch (range) {
    case 'yesterday': return { since: iso(d - 1), until: iso(d - 1) };
    case 'week':      return { since: iso(d - ((now.getUTCDay() + 6) % 7)), until: null };
    case 'month':     return { since: iso(1), until: null };
    case 'year':      return { since: iso(1, 0), until: null };
    case 'lifetime':  return { since: null, until: null };
  }
}

export interface FeedFilters {
  /** Grouping key for the active tenant: a party key, or a region key. */
  group?:    string | null;
  /** Account handle (without @), the stable identity for a politician. */
  profile?:  string | null;
  minViews?: number;
  minLikes?: number;
  style?:    string | null;
  topic?:    string | null;
}

export function usePostsData(
  range: TimeRange = 'week',
  sortKey: PostsSortKey = 'postDate',
  filters: FeedFilters = {},
): PostsState & { refresh: () => void; loadMore: () => void } {
  const [state, setState] = useState<PostsState>({
    posts:       [],
    loading:     true,
    loadingMore: false,
    error:       null,
    isLive:      false,
    hasMore:     false,
    total:       null,
  });

  const { since, until } = rangeToWindow(range);

  // Stable key for the filter set — used as the fetch dependency so a filter
  // change refetches (an object would churn identity every render).
  const filterKey = JSON.stringify({
    group:      filters.group   ?? null,
    profile:    filters.profile ?? null,
    minViews:   filters.minViews   ?? 0,
    minLikes:   filters.minLikes   ?? 0,
    style:      filters.style      ?? null,
    topic:      filters.topic      ?? null,
  });

  // Mirror the loaded count so loadMore() always requests the right offset
  // without recreating the callback on every append.
  const countRef = useRef(0);
  useEffect(() => { countRef.current = state.posts.length; }, [state.posts]);

  // Guards against overlapping fetches (e.g. rapid loadMore taps).
  const inFlightRef = useRef(false);

  const fetchPage = useCallback(async (offset: number, reset: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setState(prev => reset
      ? { ...prev, loading: true, error: null }
      : { ...prev, loadingMore: true, error: null });

    try {
      const params = new URLSearchParams();
      if (since) params.set('since', since);
      if (until) params.set('until', until);
      params.set('sortKey', sortKey);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (filters.group)      params.set('group',      filters.group);
      if (filters.profile)    params.set('profile',    filters.profile);
      if (filters.minViews)   params.set('minViews',   String(filters.minViews));
      if (filters.minLikes)   params.set('minLikes',   String(filters.minLikes));
      if (filters.style)      params.set('style',      filters.style);
      if (filters.topic)      params.set('topic',      filters.topic);

      const res  = await fetchWithRetry(`/api/posts?${params.toString()}`);
      const data = await res.json() as { posts: PostRecord[]; hasMore?: boolean; total?: number | null };
      const page = Array.isArray(data.posts) ? data.posts : [];
      const hasMore = typeof data.hasMore === 'boolean' ? data.hasMore : page.length === PAGE_SIZE;

      setState(prev => ({
        posts:       reset ? page : [...prev.posts, ...page],
        loading:     false,
        loadingMore: false,
        error:       null,
        isLive:      true,
        hasMore,
        total:       typeof data.total === 'number' ? data.total : prev.total,
      }));
    } catch (err: unknown) {
      const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
        ? err.message
        : 'Posts unavailable';
      setState(prev => ({
        ...prev,
        loading:     false,
        loadingMore: false,
        error:       uiMessage,
        isLive:      prev.posts.length > 0,
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [since, until, sortKey, filterKey]);

  // Reset to page 0 whenever the range or sort changes.
  useEffect(() => { fetchPage(0, true); }, [fetchPage]);

  const loadMore = useCallback(() => {
    setState(prev => {
      if (prev.loading || prev.loadingMore || !prev.hasMore) return prev;
      fetchPage(countRef.current, false);
      return prev;
    });
  }, [fetchPage]);

  const refresh = useCallback(() => fetchPage(0, true), [fetchPage]);

  return { ...state, refresh, loadMore };
}
