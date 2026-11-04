import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { TweetCard } from '@/components/post/tweet/TweetCard';
import { glass } from '@/theme/colors';
import { radius } from '@/theme/spacing';
import type { RecentPost, TweetData } from '@/data/types';
import type { GroupKey } from '@/theme/colors';

/**
 * TweetBangerCard
 * ----------------
 * An X post in the briefing's Top Posts strip, drawn as the tweet itself (the
 * same TweetCard the post feed uses) instead of a video tile. It takes the
 * height of the TikTok cards beside it; a long tweet scrolls inside.
 *
 * One job: frame one tweet in the strip.
 */
interface Props {
  post:     RecentPost & { tweet: TweetData };
  groupKey: GroupKey;
  delay?:   number;
}

const WIDTH = 360;
/** Height when there is no TikTok card beside it to match. */
const MIN_HEIGHT = 340;

export function TweetBangerCard({ post, groupKey, delay = 0 }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay }}
      style={styles.slot}
    >
      <View style={styles.frame}>
        <DevLabel name="TweetBangerCard" />
        {/* Absolutely placed, so the tweet never sets the strip's height */}
        <View style={StyleSheet.absoluteFill}>
          <TweetCard
            tweet={post.tweet}
            text={post.caption}
            groupKey={groupKey}
            postUrl={post.postUrl ?? ''}
            height="100%"
          />
        </View>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    minHeight: MIN_HEIGHT,
  },
  frame: {
    flex: 1,
    width: WIDTH,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
});
