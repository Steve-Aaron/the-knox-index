/**
 * data/usePostsData.ts
 * ----------------------
 * Fetches posts from /api/posts, optionally filtered by a `since` ISO date.
 * Falls back to mock list on failure.
 */
import { useState, useEffect, useCallback } from 'react';
import type { PostRecord } from './types';
import { politicians } from './politicians';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

export interface PostsState {
  posts:   PostRecord[];
  loading: boolean;
  error:   string | null;
  isLive:  boolean;
}

// Mock fallback: flatten recentPosts from seed data
const MOCK_POSTS: PostRecord[] = politicians.flatMap(p =>
  p.recentPosts.map(post => ({
    postId:         post.postId,
    profile:        p.handle.replace('@', ''),
    politicianName: p.name,
    partyKey:       p.partyKey,
    caption:        post.caption,
    videoSummary:   post.summary  ?? '',
    coverJpeg:      post.coverJpeg ?? '',
    videoMp4:       post.videoMp4  ?? '',
    postUrl:        post.postUrl   ?? '',
    postDate:       post.postDate  ?? '',
    style:          post.style     ?? '',
    topics:         post.topic ? [post.topic] : [],
    views:          post.views,
    likes:          post.likes,
    comments:       0,
    shares:         0,
    saves:          0,
    accountFollowers: p.totals.followers,
  }))
);

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

export function usePostsData(range: TimeRange = 'week'): PostsState & { refresh: () => void } {
  const [state, setState] = useState<PostsState>({
    posts:   [],   // start empty — skeletons shown until real data arrives
    loading: true,
    error:   null,
    isLive:  false,
  });

  const fetch_ = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const since = rangeToSince(range);
      const url   = since ? `/api/posts?since=${since}` : '/api/posts';
      const res   = await fetch(url);

      if (!res.ok) {
        // Do NOT pull body.detail into the thrown error — server-side SDK
        // errors have leaked credentials before. We only surface HTTP status.
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as { posts: PostRecord[] };
      if (!Array.isArray(data.posts) || data.posts.length === 0) {
        throw new Error('Empty posts response');
      }
      setState({ posts: data.posts, loading: false, error: null, isLive: true });

    } catch (err: unknown) {
      const uiMessage = err instanceof Error && /^HTTP \d+$/.test(err.message)
        ? err.message
        : 'Posts unavailable';
      setState({ posts: MOCK_POSTS, loading: false, error: uiMessage, isLive: false });
    }
  }, [range]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
