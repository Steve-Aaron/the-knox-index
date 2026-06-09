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
}

/** Convert a TimeRange key to a `since` ISO date string, or null for lifetime. */
function rangeToSince(range: TimeRange): string | null {
  if (range === 'lifetime') return null;
  const days: Record<Exclude<TimeRange, 'lifetime'>, number> = {
    yesterday: 1,
    week:      7,
    month:     30,
    year:      365,
  };
  const d = new Date();
  d.setDate(d.getDate() - days[range]);
  return d.toISOString().slice(0, 10);  // 'YYYY-MM-DD'
}

export function usePostsData(
  range: TimeRange = 'week',
  sortKey: PostsSortKey = 'postDate',
): PostsState & { refresh: () => void; loadMore: () => void } {
  const [state, setState] = useState<PostsState>({
    posts:       [],
    loading:     true,
    loadingMore: false,
    error:       null,
    isLive:      false,
    hasMore:     false,
  });

  const since = rangeToSince(range);

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
      params.set('sortKey', sortKey);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(offset));

      const res  = await fetchWithRetry(`/api/posts?${params.toString()}`);
      const data = await res.json() as { posts: PostRecord[]; hasMore?: boolean };
      const page = Array.isArray(data.posts) ? data.posts : [];
      const hasMore = typeof data.hasMore === 'boolean' ? data.hasMore : page.length === PAGE_SIZE;

      setState(prev => ({
        posts:       reset ? page : [...prev.posts, ...page],
        loading:     false,
        loadingMore: false,
        error:       null,
        isLive:      true,
        hasMore,
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
  }, [since, sortKey]);

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
