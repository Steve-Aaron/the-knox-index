import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { PagerControls, pagerText } from '@/components/primitives/PagerControls';
import { PostDetail } from '@/components/post/detail/PostDetail';
import { breakpoints } from '@/theme/breakpoints';
import { glass } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import type { PostBenchmarks, Politician } from '@/data/types';
import type { AccountPost, SocialProfile } from '@/data/account/types';
import { PostInsightHeader } from './PostInsightHeader';
import { toPostDetail } from './toPostDetail';

/**
 * PostInsightModal
 * -----------------
 * Full detail for one of the account's posts — the same PostDetail the
 * dashboard Post Feed uses — with Previous / Next through the current list.
 *
 * Controlled: the parent owns which post is open (index into `posts`).
 *
 * One job: present one post in detail and step through its neighbours.
 */
interface Props {
  posts:      AccountPost[];
  /** Index into `posts`; null hides the modal. */
  index:      number | null;
  onIndexChange: (index: number) => void;
  onClose:    () => void;
  politician: Politician;
  socials:    SocialProfile[];
  benchmarks?: PostBenchmarks;
}

/** Detail height on wide screens (matches the account widgets). */
const DETAIL_HEIGHT = 620;
/** Vertical room the header, footer and paddings take around the detail. */
const CHROME_HEIGHT = 240;
const MIN_DETAIL_HEIGHT = 420;

export function PostInsightModal({
  posts,
  index,
  onIndexChange,
  onClose,
  politician,
  socials,
  benchmarks,
}: Props) {
  const { width, height } = useWindowDimensions();
  const compact = width < breakpoints.tablet;
  const detailHeight = Math.max(MIN_DETAIL_HEIGHT, Math.min(DETAIL_HEIGHT, height - CHROME_HEIGHT));

  const post = index != null ? posts[index] : undefined;
  if (index == null || !post) return null;

  const total = posts.length;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <MotiView
          from={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.card}
        >
          <DevLabel name="PostInsightModal" />
          {/* Stop backdrop taps propagating through the content */}
          <Pressable style={styles.cardInner} onPress={e => e.stopPropagation?.()}>
            <View style={styles.header}>
              <PostInsightHeader socials={socials} onClose={onClose} />
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.detail, compact ? styles.detailCompact : { height: detailHeight }]}>
                <PostDetail
                  post={toPostDetail(post, politician)}
                  groupLabel={politician.partyLabel}
                  benchmarks={benchmarks}
                  compact={compact}
                  height={detailHeight}
                  playable
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <PagerControls
                onPrev={() => onIndexChange(index - 1)}
                onNext={() => onIndexChange(index + 1)}
                prevDisabled={index === 0}
                nextDisabled={index >= total - 1}
              >
                <Text style={pagerText.info}>
                  <Text style={pagerText.strong}>{index + 1}</Text> of {total} post{total === 1 ? '' : 's'}
                </Text>
              </PagerControls>
            </View>
          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing.lg,
  },
  card: {
    width:           '100%',
    maxWidth:        1280,
    backgroundColor: '#1F1D1D',
    borderWidth:     1,
    borderColor:     glass.borderHi,
    borderRadius:    radius.lg,
    overflow:        'hidden',
    ...Platform.select({
      web: {
        maxHeight:     '95vh',
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     '0 40px 100px rgba(0,0,0,0.75)',
      } as any,
      default: {
        maxHeight:     '95%',
        shadowColor:   '#000',
        shadowOpacity: 0.7,
        shadowRadius:  50,
        shadowOffset:  { width: 0, height: 20 },
      },
    }),
  },
  cardInner: {
    flexShrink:    1,
    flexDirection: 'column',
    ...Platform.select({ web: { cursor: 'default' } as any, default: {} }),
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: glass.border,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  // Same frame as a Post Feed card, so PostDetail sits exactly as it does there
  detail: {
    flexDirection:   'row',
    alignItems:      'stretch',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    overflow:        'hidden',
    backgroundColor: glass.card,
  },
  detailCompact: {
    flexDirection: 'column',
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
});
