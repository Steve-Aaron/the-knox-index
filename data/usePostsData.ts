/**
 * data/usePostsData.ts
 * ----------------------
 * Fetches posts from /api/posts, optionally filtered by a `since` ISO date and
 * ordered by a server-side sort key. Retries up to 3 times (1 s → 2 s → 4 s)
 * before surfacing an error. Never falls back to mock data — errors surface
 * with posts: [] so the UI can render a proper empty/error state.
 *
 * Why sortKey is server-side: with lifetime ranges spanning thousands of posts,
 * a date-priority sort + LIMIT means high-view-but-old posts never enter the
 * response window. Pushing the ORDER BY into BigQuery means the user sees the
 * top-N for whichever metric they care about.
 */
import { useState, useEffect, useCallback } from 'react';
import type { PostRecord } from './types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import { fetchWithRetry } from './fetchWithRetry';

/** Sort keys supported by /api/posts — must match the API's whitelist. */
export type PostsSortKey = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'virality' | 'postDate';

export interface PostsState {
  posts:   PostRecord[];
  loading: boolean;
  error:   string | null;
  isLive:  boolean;
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
): PostsState & { refresh: () => void } {
  const [state, setState] = useState<PostsState>({
    posts:   [],
    loading: true,
    error:   null,
    isLive:  false,
  });

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const since  = rangeToSince(range);
      const params = new URLSearchParams();
      if (since) params.set('since', since);
      params.set('sortKey', sortKey);
      const url = `/api/posts?${params.toString()}`;

      // fetchWithRetry handles network errors and 5xx with back-off.
      const res = await fetchWithRetry(url);

      const data = await res.json() as { posts: PostRecord[] };
      // Accept an empty array — no processed posts in this window is valid,
      // not an error.
      setState({
        posts:   Array.isArray(data.posts) ? data.posts : [],
        loading: false,
        error:   null,
        isLive:  true,
      });

    } catch (err: unknown) {
      // Never echo full error details — only surface HTTP status when available.
      const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
        ? err.message
        : 'Posts unavailable';
      setState({ posts: [], loading: false, error: uiMessage, isLive: false });
    }
  }, [range, sortKey]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
