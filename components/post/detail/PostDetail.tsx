import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colourFor, glass } from '@/theme/colors';
import type { PostBenchmarks } from '@/data/types';
import { postEngagementRate } from '@/lib/postMetrics';
import { PostAiSummary } from './PostAiSummary';
import { PostCompareSection } from './PostCompareSection';
import { PostCover } from './PostCover';
import { PostInfoSection } from './PostInfoSection';
import { PostMetricsRow } from './PostMetricsRow';
import { POST_DETAIL_HEIGHT, postCoverWidth, tweetCardWidth, type PostDetailData } from './postDetailLayout';
import { TweetCard } from '@/components/post/tweet/TweetCard';

/**
 * PostDetail
 * -----------
 * The full post view: cover on the left; AI summary → metrics → 'how this
 * post compares' → identity, caption + tags on the right. Stacks into one
 * column when compact.
 *
 * Renders the cover and the column as siblings, so the caller owns the
 * container (a pressable feed card, a modal body…) and its direction:
 * flexDirection 'row' for the side-by-side layout, 'column' for compact.
 *
 * One job: lay out the parts of one post.
 */
interface Props {
  post:        PostDetailData;
  /** Party / region label shown next to the author. */
  groupLabel:  string;
  benchmarks?: PostBenchmarks;
  /** Stacked layout for narrow screens. */
  compact?:    boolean;
  /** Height of the side-by-side layout; sets the 9:16 cover size. */
  height?:     number;
  isAdmin?:    boolean;
  activeStyle?: string | null;
  activeTopic?: string | null;
  onStylePress?: (style: string) => void;
  onTopicPress?: (topic: string) => void;
}

export function PostDetail({
  post,
  groupLabel,
  benchmarks,
  compact = false,
  height = POST_DETAIL_HEIGHT,
  isAdmin = false,
  activeStyle,
  activeTopic,
  onStylePress,
  onTopicPress,
}: Props) {
  const colour = colourFor(post.groupKey);

  return (
    <>
      {post.tweet ? (
        // X: the tweet itself stands where a TikTok's 9:16 cover would.
        <TweetCard
          tweet={post.tweet}
          text={post.caption}
          groupKey={post.groupKey}
          postUrl={post.postUrl ?? ''}
          width={compact ? '100%' : tweetCardWidth(height)}
          height={compact ? undefined : height}
        />
      ) : (
        <PostCover
          uri={post.coverJpeg}
          views={post.views}
          accentColour={colour.base}
          width={postCoverWidth(height)}
          height={height}
          compact={compact}
        />
      )}

      {/* Content column: summary → metrics → distributions → info */}
      <View style={styles.column}>
        {/* 1. AI SUMMARY — most prominent, next to video */}
        <PostAiSummary
          key={post.postId}
          postId={String(post.postId)}
          initialSummary={post.videoSummary}
          isAdmin={isAdmin}
        />

        <View style={styles.divider} />

        {/* 2. METRICS — large and readable */}
        <PostMetricsRow
          platform={post.platform}
          views={post.views}
          likes={post.likes}
          comments={post.comments}
          shares={post.shares}
          colour={colour.glow}
        />

        <View style={styles.divider} />

        {/* 3. BOX-AND-WHISKER DISTRIBUTIONS — side by side to save vertical space */}
        {benchmarks ? (
          <PostCompareSection
            views={post.views}
            engagementRate={postEngagementRate(post)}
            benchmarks={benchmarks}
            colour={colour.glow}
            stacked={compact}
          />
        ) : null}

        <View style={styles.divider} />

        {/* 4. IDENTITY + CAPTION + TAGS — contextual, below the fold */}
        <PostInfoSection
          authorName={post.politicianName}
          groupLabel={groupLabel}
          postDate={post.postDate}
          // An X post's words are already in the tweet card beside this column.
          caption={post.tweet ? '' : post.caption}
          styles={post.styles}
          topics={post.topics}
          colour={colour}
          activeStyle={activeStyle}
          activeTopic={activeTopic}
          onStylePress={onStylePress}
          onTopicPress={onTopicPress}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  // Hairline divider between the sections
  divider: {
    height: 1,
    backgroundColor: glass.border,
  },
});
