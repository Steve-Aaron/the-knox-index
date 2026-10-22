import type { Politician } from '@/data/types';
import type { AccountPost } from '@/data/account/types';
import type { PostDetailData } from '@/components/post/detail/postDetailLayout';

/**
 * Account post → the shared PostDetail shape. The account data speaks its own
 * shape; this keeps the shared post components unaware of it.
 */
export function toPostDetail(post: AccountPost, politician: Politician): PostDetailData {
  return {
    postId:         post.id,
    politicianName: politician.name,
    groupKey:       politician.groupKey,
    caption:        post.caption,
    videoSummary:   post.summary ?? '',
    coverJpeg:      post.coverJpeg ?? '',
    postDate:       post.postDate,
    styles:         post.styles,
    topics:         post.topics,
    views:          post.views,
    likes:          post.likes,
    comments:       post.comments,
    shares:         post.shares,
    saves:          post.saves,
  };
}

