import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtDate, fmtLabel } from '@/lib/format';
import { accent, glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * PostInfoSection
 * ----------------
 * Who posted it (dot + name + group · date), the caption, and the style /
 * topic tags. Tags are pressable so a feed can filter by them; the active
 * filter is highlighted.
 *
 * One job: ground the post detail in its author, caption and tags.
 */
interface Props {
  authorName:  string;
  /** e.g. the party / region label shown before the date. */
  groupLabel:  string;
  postDate?:   string;
  caption:     string;
  styles?:     string[];
  topics?:     string[];
  colour:      { base: string; glow: string };
  activeStyle?: string | null;
  activeTopic?: string | null;
  onStylePress?: (style: string) => void;
  onTopicPress?: (topic: string) => void;
}

const MAX_TOPICS = 3;

export function PostInfoSection({
  authorName,
  groupLabel,
  postDate,
  caption,
  styles: postStyles,
  topics,
  colour,
  activeStyle,
  activeTopic,
  onStylePress,
  onTopicPress,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.identityRow}>
        <View style={[styles.dot, { backgroundColor: colour.base }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: colour.glow }]} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {groupLabel}
            {postDate ? ` · ${fmtDate(postDate)}` : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
      <View style={styles.tags}>
        {(postStyles ?? []).map(s => (
          <Tag
            key={s}
            label={s}
            kind="style"
            active={activeStyle?.toLowerCase() === s.toLowerCase()}
            onPress={() => onStylePress?.(s)}
          />
        ))}
        {(topics ?? []).slice(0, MAX_TOPICS).map(t => (
          <Tag
            key={t}
            label={t}
            kind="topic"
            active={activeTopic?.toLowerCase() === t.toLowerCase()}
            onPress={() => onTopicPress?.(t)}
          />
        ))}
      </View>
    </View>
  );
}

function Tag({ label, kind, active, onPress }: {
  label:   string;
  kind:    'style' | 'topic';
  active:  boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        kind === 'style' ? styles.styleTag : styles.topicTag,
        active && styles.tagActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{fmtLabel(label)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: glass.border,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  name: {
    fontFamily: font.bold,
    color: neutral.text,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  metaLine: {
    fontFamily: font.ui,
    color: neutral.textDim,
    fontSize: 12,
    textTransform: 'none',
  },
  caption: {
    fontFamily: font.ui,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 18,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  styleTag: {
    backgroundColor: 'rgba(95,100,189,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(95,100,189,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topicTag: {
    backgroundColor: 'rgba(202,193,228,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(202,193,228,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.bold, fontSize: 12, color: neutral.textMid },
  tagActive: {
    backgroundColor: 'rgba(95,100,189,0.35)',
    borderColor: accent.indigo,
  },
  tagTextActive: { color: accent.indigo },
});
