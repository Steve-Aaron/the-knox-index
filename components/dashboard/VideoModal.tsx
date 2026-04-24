import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MotiView } from 'moti';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * VideoModal
 * -----------
 * Overlay player for post videos.
 * Card: max 95vh, internally scrollable.
 * Video: max 80vh, 9:16 portrait ratio.
 * Falls back to cover image when no videoMp4 is present.
 */
interface Props {
  visible:    boolean;
  videoMp4?:  string;
  coverJpeg?: string;
  caption?:   string;
  postUrl?:   string;
  onClose:    () => void;
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });

  // Play after mount — setup callback fires before the view attaches,
  // so browsers may ignore it. useEffect fires post-render with the
  // user gesture still in scope, satisfying autoplay policies.
  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}

export function VideoModal({ visible, videoMp4, coverJpeg, caption, postUrl, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <MotiView
          from={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.card}
        >
          {/* Stop backdrop tap propagating through to content */}
          <Pressable style={styles.cardInner} onPress={e => e.stopPropagation?.()}>

            {/* Scrollable body: video + caption */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.videoWrap}>
                {videoMp4
                  ? <VideoPlayer uri={videoMp4} />
                  : coverJpeg
                  ? <Image source={{ uri: coverJpeg }} style={styles.cover} resizeMode="cover" />
                  : <View style={[styles.cover, styles.coverFallback]} />
                }
              </View>

              {caption ? (
                <Text style={styles.caption}>{caption}</Text>
              ) : null}
            </ScrollView>

            {/* Sticky footer — always visible at the bottom of the card */}
            <View style={styles.footer}>
              {postUrl ? (
                <Pressable
                  style={styles.openBtn}
                  onPress={() => Linking.openURL(postUrl)}
                >
                  <Text style={styles.openBtnText}>View on TikTok ↗</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>

          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Card: max 95vh tall, 420px wide, flex column so footer sticks to bottom
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0a0a12',
    borderWidth: 1,
    borderColor: glass.borderHi,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.75)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.7,
        shadowRadius: 50,
        shadowOffset: { width: 0, height: 20 },
      },
    }),
  },

  // Inner pressable must fill the card and allow the footer to stay put
  cardInner: {
    flex: 1,
    flexDirection: 'column',
  },

  // Scrollable region: flex: 1 so it fills remaining height above the footer
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
  },

  // Video wrapper: background black, no explicit height — video sizes itself
  videoWrap: {
    backgroundColor: '#000',
  },

  // Video: 9:16, capped at 80vh so it never fills the whole screen
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    ...Platform.select({
      web: { maxHeight: '80vh' } as any,
      default: {},
    }),
  },

  // Cover fallback: same proportions
  cover: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#111',
    ...Platform.select({
      web: { maxHeight: '80vh' } as any,
      default: {},
    }),
  },
  coverFallback: {
    backgroundColor: '#1a1a2e',
  },

  caption: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.md,
  },

  // Footer: never scrolls, always anchored to the card bottom
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.sm,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: glass.border,
    backgroundColor: '#0a0a12',
  },
  openBtn: {
    flex: 1,
    backgroundColor: accent.indigo,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  openBtnText: {
    ...type.caption,
    color: '#fff',
    fontSize: 11,
  },
  closeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  closeBtnText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 11,
  },
});
