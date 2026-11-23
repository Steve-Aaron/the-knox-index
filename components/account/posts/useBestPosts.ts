import { useMemo, useState } from 'react';
import type { AccountPost } from '@/data/account/types';

/**
 * useBestPosts
 * -------------
 * Sort + threshold state for the best-posts widget, and the derived list.
 * Kept out of the component so the filtering rules can be tested and later
 * moved server-side without touching the UI.
 */
export type BestPostsSortKey =
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'engagementRate'
  | 'virality'
  | 'postDate';

const SORT_VALUE: Record<BestPostsSortKey, (p: AccountPost) => number> = {
  views:          p => p.views,
  likes:          p => p.likes,
  comments:       p => p.comments,
  shares:         p => p.shares,
  engagementRate: p => p.engagementRate,
  virality:       p => p.virality,
  postDate:       p => Date.parse(p.postDate),
};

export function useBestPosts(posts: AccountPost[]) {
  const [sortKey, setSortKey] = useState<BestPostsSortKey>('views');
  const [minViews, setMinViews] = useState(0);
  const [minLikes, setMinLikes] = useState(0);

  const visible = useMemo(() => {
    const value = SORT_VALUE[sortKey];
    return posts
      .filter(p => p.views >= minViews && p.likes >= minLikes)
      .sort((a, b) => value(b) - value(a));
  }, [posts, sortKey, minViews, minLikes]);

  return {
    visible,
    sortKey,
    setSortKey,
    minViews,
    setMinViews,
    minLikes,
    setMinLikes,
  };
}
