import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShimmerImage } from '@/components/primitives/ShimmerImage';
import { formatters } from '@/components/primitives/CountUp';
import { neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { track } from '@/lib/analytics';
import { PostVideo } from './PostVideo';

/**
 * PostCover
 * ----------
 * 9:16 cover thumbnail with a 'views' badge in the corner. Fixed size beside
 * the detail column, or full width when the detail is stacked (compact).
 * Given a video, it shows a play button; pressing it swaps the cover for an
 * inline player. Key it by post so the next post starts on its cover again.
 *
 * One job: show a post's cover (and its video on demand).
 */
interface Props {
  uri?:         string;
  views:        number;
  accentColour: string;
  /** Detail height; the cover is height × 9/16 wide. Ignored when compact. */
  width:        number;
  height:       number;
  compact?:     boolean;
  /** Makes the cover playable in place. */
  video?:       { uri: string; postId: string };
}

export function PostCover({ uri, views, accentColour, width, height, compact = false, video }: Props) {
  const size = compact ? styles.coverCompact : { width, height };
  const [playing, setPlaying] = useState(false);

  const play = () => {
    setPlaying(true);
    try { track('video_play_started', { post_id: video?.postId ?? null, source: 'post_detail' }); } catch {}
  };

  if (video && playing) {
    return (
      <View style={compact ? styles.wrapCompact : [styles.wrap, { width, height }]}>
        <PostVideo uri={video.uri} poster={uri || undefined} />
      </View>
    );
  }

  return (
    <View style={compact ? styles.wrapCompact : [styles.wrap, { width }]}>
      <ShimmerImage
        uri={uri || undefined}
        wrapStyle={size}
        resizeMode="cover"
        accentColour={accentColour}
        fallback={
          <View style={[size, styles.fallback]}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        }
      />
      {video ? (
        <Pressable
          onPress={play}
          accessibilityRole="button"
          accessibilityLabel="Play video"
          style={styles.playOverlay}
        >
          <View style={styles.playButton}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
        </Pressable>
      ) : null}
      <View style={styles.viewsBadge} pointerEvents="none">
        <Text style={styles.viewsNum}>{formatters.compact(views)}</Text>
        <Text style={styles.viewsLbl}> views</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  // Compact cover — 9:16 portrait at full width, matching the desktop ratio.
  wrapCompact: {
    width: '100%' as any,
    aspectRatio: 9 / 16,
    position: 'relative' as const,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  coverCompact: {
    width: '100%' as any,
    height: '100%' as any,
  },
  fallback: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 24, color: neutral.textDim },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  playButton: {
    width:           56,
    height:          56,
    borderRadius:    28,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.25)',
  },
  // ▶ sits visually left of centre; nudge it to the optical middle.
  playGlyph: { fontSize: 20, color: '#fff', marginLeft: 3 },
  viewsBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewsNum: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  viewsLbl: { fontFamily: font.ui, fontSize: 12, color: neutral.textMid, textTransform: 'none' },
});
