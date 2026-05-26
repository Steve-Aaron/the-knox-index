import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { ShimmerImage } from '@/components/primitives/ShimmerImage';
import { VideoModal } from '@/components/dashboard/VideoModal';
import { neutral, glass, party } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { breakpoints } from '@/theme/breakpoints';
import { type, font } from '@/theme/typography';
import { fmtLabel } from '@/lib/format';
import type { RecentPost } from '@/data/types';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * AccountPostCard
 * ----------------
 * Horizontal card: thumbnail column on the left, content on the right.
 *
 * Desktop — cover column = 20% of screen width, portrait crop, fills card height.
 * Mobile  — cover column = 50% of card width, portrait crop.
 *
 * Tap anywhere opens VideoModal.
 * One job: display one post.
 */

interface Props {
  post:     RecentPost;
  partyKey: PartyKey;
  name?:    string;
  delay?:   number;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={[statStyles.value, { color }]}>{value.toLocaleString()}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 4 },
  value: { fontFamily: font.bold, fontSize: 48, lineHeight: 52 },
  label: { fontFamily: font.ui, fontSize: 11, color: neutral.textDim, letterSpacing: 1.0 } as any,
});

export function AccountPostCard({ post, partyKey, name, delay = 0 }: Props) {
  const { width }  = useWindowDimensions();
  const isDesktop  = width >= breakpoints.desktop;
  const colour     = party[partyKey];
  const [open, setOpen] = useState(false);

  const engRate = post.views > 0
    ? +(((post.likes + post.comments + (post.saves ?? 0) + post.shares) / post.views) * 100).toFixed(2)
    : 0;

  const hasCover = !!post.coverJpeg;
  const hasVideo = !!post.videoMp4;

  // Cover column width: 20% of screen on desktop, 50% of card (which is full-width) on mobile
  const coverWidth = isDesktop ? width * 0.20 : '50%' as any;

  return (
    <>
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 280, delay }}
      >
        <Pressable
          onPress={() => { if (hasVideo) setOpen(true); }}
          style={({ pressed, hovered }: any) => [
            styles.card,
            hovered && { borderColor: colour.base },
            pressed && { opacity: 0.88 },
          ]}
          accessibilityRole={hasVideo ? 'button' : undefined}
        >
          <DevLabel name="account-post-card" />
          {/* ── Thumbnail column ────────────────────────────────────────── */}
          <View style={[styles.coverCol, { width: coverWidth }]}>
            {hasCover ? (
              <ShimmerImage
                uri={post.coverJpeg!}
                wrapStyle={styles.cover}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>No preview</Text>
              </View>
            )}

            {/* Play overlay */}
            {hasVideo && (
              <View style={styles.playOverlay} pointerEvents="none">
                <View style={[styles.playBtn, { borderColor: colour.base }]}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
              </View>
            )}

            {/* Date badge */}
            {post.postDate && (
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{post.postDate.slice(0, 10)}</Text>
              </View>
            )}
          </View>

          {/* ── Content column ──────────────────────────────────────────── */}
          <View style={styles.content}>
            <Text style={styles.caption} numberOfLines={4}>{post.caption}</Text>

            {post.summary ? (
              <View style={styles.summaryWrap}>
                <Text style={styles.summaryKicker}>AI SUMMARY</Text>
                <Text style={styles.summary} numberOfLines={5}>{post.summary}</Text>
              </View>
            ) : null}

            {(post.styles ?? []).length > 0 ? (
              <View style={styles.tagRow}>
                {(post.styles ?? []).map(s => (
                  <View key={s} style={[styles.tag, { borderColor: colour.base + '55', backgroundColor: colour.base + '15' }]}>
                    <Text style={[styles.tagText, { color: colour.base }]}>{fmtLabel(s)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <Stat label="VIEWS"    value={post.views}    color={colour.base} />
              <View style={styles.statDivider} />
              <Stat label="LIKES"    value={post.likes}    color={colour.base} />
              <View style={styles.statDivider} />
              <Stat label="COMMENTS" value={post.comments} color={colour.base} />
              <View style={styles.statDivider} />
              <Stat label="SHARES"   value={post.shares}   color={colour.base} />
            </View>

            <View style={styles.engRow}>
              <Text style={styles.engLabel}>ENGAGEMENT RATE</Text>
              <Text style={[styles.engValue, { color: colour.base }]}>
                {post.views > 0 ? `${engRate}%` : '—'}
              </Text>
            </View>
          </View>
        </Pressable>
      </MotiView>

      <VideoModal
        visible={open}
        videoMp4={post.videoMp4}
        coverJpeg={post.coverJpeg}
        caption={post.caption}
        postUrl={post.postUrl}
        postId={post.postId}
        politicianName={name}
        partyKey={partyKey}
        views={post.views}
        styles={post.styles}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.card,
    borderRadius:    radius.md,
    overflow:        'hidden',
    minHeight:       220,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color',
        transitionDuration: '180ms',
        cursor:             'pointer',
      } as any,
      default: {},
    }),
  },

  // Thumbnail column — width set inline; height derived from 9:16 aspect ratio
  coverCol: {
    flexShrink:  0,
    aspectRatio: 9 / 16,   // portrait — height = width × (16/9)
    overflow:    'hidden',
  },
  // wrapStyle on ShimmerImage — fills the coverCol
  cover: {
    flex:  1,
    width: '100%',
  },
  coverPlaceholder: {
    backgroundColor: glass.fill,
    alignItems:      'center',
    justifyContent:  'center',
  },
  coverPlaceholderText: {
    fontFamily: font.ui,
    color:      neutral.textDim,
    fontSize:   11,
  } as any,

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    borderWidth:     2,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  playIcon: {
    color:      neutral.text,
    fontSize:   16,
    marginLeft: 3,
  },

  dateBadge: {
    position:          'absolute',
    bottom:            spacing.sm,
    left:              spacing.sm,
    backgroundColor:   'rgba(0,0,0,0.65)',
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  dateText: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textMid,
    letterSpacing: 0.4,
  },

  // Content column
  content: {
    flex:    1,
    padding: spacing.md,
    gap:     spacing.sm,
  },
  caption: {
    ...type.body,
    color:      neutral.text,
    fontSize:   16,
    lineHeight: 23,
  },
  summaryWrap: {
    gap:             6,
    padding:         spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius:    radius.sm,
    borderWidth:     1,
    borderColor:     glass.border,
  },
  summaryKicker: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  summary: {
    ...type.body,
    color:      neutral.textMid,
    fontSize:   14,
    lineHeight: 21,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  tag: {
    borderWidth:       1,
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
  },
  tagText: {
    fontFamily:    font.bold,
    fontSize:      12,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.lg,
    flexWrap:      'wrap',
  },
  statDivider: {
    width:           1,
    height:          48,
    backgroundColor: glass.border,
  },
  engRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  engLabel: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
  engValue: {
    fontFamily: font.bold,
    fontSize:   20,
  },
});
