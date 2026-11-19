import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StyleChip } from '@/components/primitives/StyleChip';
import { fmtDate } from '@/lib/format';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { postEngagementRate } from '@/lib/postMetrics';
import { PostEngagementRow } from './PostEngagementRow';
import { PostPlatformIcon, type PostPlatformGlyph } from './PostPlatformIcon';
import { PostStatsRow } from './PostStatsRow';

/**
 * PostSummaryCard
 * ----------------
 * Compact post card: caption, AI summary, tags, date, the four counts and
 * the engagement rate. Shared by the dashboard's Recent posts list and the
 * account page's Best posts list.
 *
 *   stacked  everything in one column, date beside the numbers (side panels)
 *   narrow   stacked, with the date above the numbers so they fit a phone
 *   split    text on the left, date + numbers on the right (wide lists)
 *
 * What a press does is up to the caller (open the post, open a modal…).
 *
 * One job: render one post as a card.
 */
export interface PostSummaryCardData {
  caption:   string;
  summary?:  string;
  /** Content styles, tinted with the account colour. */
  styles?:   string[];
  /** Topics, shown after the styles in neutral grey. */
  topics?:   string[];
  views:     number;
  likes:     number;
  comments:  number;
  shares:    number;
  saves?:    number;
  postDate?: string;
}

interface Props {
  post:          PostSummaryCardData;
  /** Account colour pair, e.g. colourFor(groupKey). */
  colour:        { base: string; glow: string };
  layout?:       'stacked' | 'narrow' | 'split';
  /** Prefixes the caption with '#rank'. */
  rank?:         number;
  /** Platform mark in the corner. Omit to hide it. */
  platformIcon?: PostPlatformGlyph;
  /** No handler → the card is static (no hover, no press feedback). */
  onPress?:      () => void;
  accessibilityRole?: 'link' | 'button';
}

const MAX_STYLES = 4;
const MAX_TOPICS = 3;

export function PostSummaryCard({
  post,
  colour,
  layout = 'stacked',
  rank,
  platformIcon,
  onPress,
  accessibilityRole,
}: Props) {
  const engRate  = postEngagementRate(post);
  const caption  = rank != null ? `#${rank} ${post.caption}` : post.caption;
  const interactive = !!onPress;

  const captionRow = (
    <View style={styles.captionRow}>
      <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
      {layout !== 'split' && platformIcon ? <PostPlatformIcon glyph={platformIcon} /> : null}
    </View>
  );

  // AI summary — falls back to nothing when missing so the layout stays tight
  const summary = post.summary ? (
    <Text style={styles.summary} numberOfLines={3}>{post.summary}</Text>
  ) : null;

  // Content styles (+ topics) — surface what kind of post this is
  const postStyles = (post.styles ?? []).slice(0, MAX_STYLES);
  const postTopics = (post.topics ?? []).slice(0, MAX_TOPICS);
  const tags = postStyles.length + postTopics.length > 0 ? (
    <View style={styles.tags}>
      {postStyles.map(s => (
        <StyleChip key={`s-${s}`} label={s} tint={colour.glow} compact />
      ))}
      {postTopics.map(t => (
        <StyleChip key={`t-${t}`} label={t} tint={neutral.textMid} compact />
      ))}
    </View>
  ) : null;

  const date = post.postDate ? (
    <Text style={styles.date}>{fmtDate(post.postDate)}</Text>
  ) : null;

  const stats = (
    <PostStatsRow
      views={post.views}
      likes={post.likes}
      comments={post.comments}
      shares={post.shares}
      accentColor={colour.glow}
      spread={layout !== 'stacked'}
    />
  );

  const engagement = (
    <PostEngagementRow rate={engRate} hasViews={post.views > 0} accentColor={colour.glow} />
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.card,
        layout === 'split' && styles.cardSplit,
        interactive && hovered && { borderColor: colour.base, backgroundColor: 'rgba(255,255,255,0.04)' },
        interactive && pressed && { opacity: 0.8 },
      ]}
      accessibilityRole={interactive ? accessibilityRole : undefined}
    >
      {layout === 'split' ? (
        <>
          <View style={styles.splitMain}>
            {captionRow}
            {summary}
            {tags}
          </View>
          <View style={styles.splitSide}>
            <View style={styles.splitHeader}>
              {date ?? <View />}
              {platformIcon ? <PostPlatformIcon glyph={platformIcon} /> : null}
            </View>
            {stats}
            {engagement}
          </View>
        </>
      ) : (
        <>
          {captionRow}
          {summary}
          {tags}
          {/* Date + 4 stats: Views, Likes, Comments, Shares */}
          <View style={layout === 'narrow' ? styles.metaNarrow : styles.meta}>
            {date}
            {stats}
          </View>
          {/* Engagement rate strip */}
          {engagement}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.card,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color, background-color',
        transitionDuration: '160ms',
        cursor: 'pointer',
        overflowX: 'hidden',
      } as any,
      default: {},
    }),
  },
  cardSplit: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  splitMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  splitSide: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  caption: {
    flex: 1,
    ...type.body,
    color: neutral.text,
    fontSize: 16,
    lineHeight: 18,
  },
  summary: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  tags: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaNarrow: {
    gap: spacing.sm,
  },
  date: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    textTransform: 'none' as const,
    flexShrink: 0,
  },
});
