import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { ShimmerImage } from '@/components/primitives/ShimmerImage';
import { MotiView } from 'moti';
import { VideoModal } from './VideoModal';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, party, accent } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatters } from '@/components/primitives/CountUp';
import type { RecentPost } from '@/data/types';
import type { PartyKey } from '@/theme/colors';

/**
 * PostBangerCard
 * ---------------
 * Thumbnail card for the 'What banged on TikTok?' strip.
 * Shows cover image, views, caption, politician chip.
 * Tap to play the video in VideoModal or open URL.
 * One job.
 */
interface Props {
  post: RecentPost;
  politicianName: string;
  partyKey: PartyKey;
  delay?: number;
}

export function PostBangerCard({ post, politicianName, partyKey, delay = 0 }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const colour = party[partyKey];

  const handlePress = () => {
    if (post.videoMp4) {
      setModalOpen(true);
    } else if (post.postUrl) {
      Linking.openURL(post.postUrl);
    }
  };

  return (
    <>
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay }}
      >
        <Pressable
          onPress={handlePress}
          style={({ pressed, hovered }: any) => [
            styles.card,
            hovered && { borderColor: colour.base },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <DevLabel name="PostBangerCard" />
          {/* Cover image */}
          <View style={styles.imageWrap}>
            <ShimmerImage
              uri={post.coverJpeg}
              wrapStyle={styles.image}
              accentColour={colour.base}
              fallback={
                <View style={[styles.image, styles.imageFallback]}>
                  <Text style={styles.imageFallbackText}>▶</Text>
                </View>
              }
            />
            {/* Play overlay */}
            <View style={styles.playOverlay}>
              <View style={[styles.playBtn, { borderColor: colour.base }]}>
                <Text style={[styles.playIcon, { color: colour.glow }]}>▶</Text>
              </View>
            </View>
            {/* Views badge */}
            <View style={styles.viewsBadge}>
              <Text style={styles.viewsText}>{formatters.compact(post.views)}</Text>
              <Text style={styles.viewsLabel}> views</Text>
            </View>
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
            <View style={styles.meta}>
              <View style={[styles.partyDot, { backgroundColor: colour.base }]} />
              <Text style={[styles.name, { color: colour.glow }]} numberOfLines={1}>
                {politicianName}
              </Text>
            </View>
            {post.postUrl ? (
              <Pressable
                onPress={e => { e.stopPropagation?.(); Linking.openURL(post.postUrl!); }}
                style={styles.linkRow}
              >
                <Text style={styles.linkText}>View on TikTok →</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </MotiView>

      <VideoModal
        visible={modalOpen}
        videoMp4={post.videoMp4}
        coverJpeg={post.coverJpeg}
        caption={post.caption}
        postUrl={post.postUrl}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: glass.card,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transitionProperty: 'border-color',
        transitionDuration: '180ms',
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  imageWrap: {
    height: 240,
    backgroundColor: '#111',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 28,
    color: neutral.textDim,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 16,
    marginLeft: 2,
  },
  viewsBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewsText: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  viewsLabel: {
    ...type.caption,
    fontSize: 12,
    color: neutral.textMid,
    textTransform: 'none',
    letterSpacing: 0,
  },
  info: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  caption: {
    ...type.body,
    fontSize: 12,
    color: neutral.textMid,
    lineHeight: 17,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  partyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  name: {
    ...type.caption,
    fontSize: 12,
    letterSpacing: 0.4,
    flex: 1,
  },
  linkRow: {
    paddingTop: 2,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  linkText: {
    ...type.caption,
    fontSize: 12,
    color: accent.indigo,
    letterSpacing: 0.2,
  },
});
