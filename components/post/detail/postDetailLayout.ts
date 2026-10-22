import type { PostRecord } from '@/data/types';

/**
 * postDetailLayout
 * -----------------
 * Shared sizing + data contract for the full post detail (cover on the left,
 * summary / metrics / distributions / identity on the right).
 */

/** Default detail height — one Post Feed card fills the feed window exactly. */
export const POST_DETAIL_HEIGHT = 480;

/** Cover width for a given detail height: an exact 9:16 portrait. */
export function postCoverWidth(height: number): number {
  return Math.round(height * (9 / 16));
}

/**
 * Fields the detail view reads. A subset of PostRecord, so feed posts pass
 * straight through; other sources (account mocks) map into it.
 */
export type PostDetailData = Pick<
  PostRecord,
  | 'postId'
  | 'politicianName'
  | 'groupKey'
  | 'caption'
  | 'videoSummary'
  | 'coverJpeg'
  | 'postDate'
  | 'styles'
  | 'topics'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
>;
