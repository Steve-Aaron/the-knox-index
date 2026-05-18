import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { PostRecord } from '@/data/types';

/**
 * TopicCloud
 * -----------
 * Aggregates topics across the visible post feed and renders them as pills
 * sized by frequency. Answers 'what subjects are being talked about' and
 * 'what are people TikTokking about this year' from the brief.
 * One job: surface dominant topics fast.
 */

interface Props {
  posts:       PostRecord[];
  rangeLabel?: string;
  topN?:       number;
}

interface TopicEntry {
  label: string;
  count: number;
  share: number;     // 0..1 of total
  bucket: 0 | 1 | 2 | 3;  // size tier
}

export function TopicCloud({ posts, rangeLabel, topN = 24 }: Props) {
  const entries = useMemo<TopicEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of p.topics ?? []) {
        const key = (t || '').trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const total = Array.from(counts.values()).reduce((s, c) => s + c, 0);
    if (total === 0) return [];

    const sorted = Array.from(counts.entries())
      .map(([key, count]) => ({
        label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        count,
        share: count / total,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);

    const max = sorted[0]?.count ?? 1;
    return sorted.map(e => ({
      ...e,
      bucket: e.count >= max * 0.66
        ? 3
        : e.count >= max * 0.33
          ? 2
          : e.count >= max * 0.15
            ? 1
            : 0,
    }) as TopicEntry);
  }, [posts, topN]);

  return (
    <GlassSurface style={styles.wrap} radius={radius.lg}>
      <DevLabel name="TopicCloud" />

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>SUBJECTS{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Text>
          <Text style={styles.title}>What's being talked about?</Text>
        </View>
        <InfoTip
          text="Each post is tagged with one or more topics during ingestion. The pills are sized and tinted by how often each topic shows up in the visible feed."
          width={260}
        />
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No topics tagged in the current period yet.</Text>
      ) : (
        <View style={styles.cloud}>
          {entries.map(e => {
            const style = TIERS[e.bucket];
            return (
              <View key={e.label} style={[styles.pill, style.pill]}>
                <Text style={[styles.pillText, style.text]}>{e.label}</Text>
                <Text style={styles.pillCount}>{e.count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </GlassSurface>
  );
}

// Per-tier visual treatment. Higher frequency = bigger and more saturated.
const TIERS = [
  {
    pill: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
    text: { color: neutral.textDim, fontSize: 12 },
  },
  {
    pill: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
    text: { color: neutral.textMid, fontSize: 12 },
  },
  {
    pill: { backgroundColor: 'rgba(110,255,180,0.12)', borderColor: 'rgba(110,255,180,0.35)' },
    text: { color: accent.mint, fontSize: 16, fontWeight: '600' as const },
  },
  {
    pill: { backgroundColor: 'rgba(124,131,255,0.18)', borderColor: 'rgba(124,131,255,0.55)' },
    text: { color: accent.indigo, fontSize: 16, fontWeight: '700' as const },
  },
] as const;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  title: {
    ...type.title,
    color: neutral.text,
    fontSize: 16,
    marginTop: 2,
  },
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: {
    ...type.body,
  },
  pillCount: {
    fontFamily: font.mono,
    fontSize: 12,
    color: neutral.textDim,
  },
  emptyText: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
