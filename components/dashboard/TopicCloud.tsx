import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, accent, secondary } from '@/theme/colors';
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
  /** Whole-range server counts; when provided, used instead of the loaded feed. */
  counts?:     { label: string; count: number }[];
  rangeLabel?: string;
  topN?:       number;
}

interface TopicEntry {
  label: string;
  count: number;
  share: number;     // 0..1 of total
  bucket: 0 | 1 | 2 | 3;  // size tier
}

export function TopicCloud({ posts, counts, rangeLabel, topN = 24 }: Props) {
  const entries = useMemo<TopicEntry[]>(() => {
    const tally = new Map<string, number>();
    if (counts && counts.length) {
      for (const c of counts) {
        const key = String(c.label ?? '').trim().toLowerCase();
        if (!key) continue;
        tally.set(key, (tally.get(key) ?? 0) + Number(c.count ?? 0));
      }
    } else {
      for (const p of posts) {
        for (const t of p.topics ?? []) {
          const key = (t || '').trim().toLowerCase();
          if (!key) continue;
          tally.set(key, (tally.get(key) ?? 0) + 1);
        }
      }
    }
    const total = Array.from(tally.values()).reduce((s, c) => s + c, 0);
    if (total === 0) return [];

    const sorted = Array.from(tally.entries())
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
  }, [posts, counts, topN]);

  return (
    <DashCard
      style={styles.wrap}
      infoText="Each post is tagged with one or more topics during ingestion. The pills are sized and tinted by how often each topic shows up in the visible feed."
      infoTitle="Subjects"
    >
      <DevLabel name="TopicCloud" />

      <View style={styles.header}>
        <View>
          <Kicker tone='dim'>SUBJECTS{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Kicker>
          <Title style={{ fontSize: 16, marginTop: 2 }}>What's being talked about?</Title>
        </View>
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
    </DashCard>
  );
}

// Per-tier visual treatment. All pills are the same size — colour carries the hierarchy.
const TIERS = [
  {
    pill: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
    text: { color: neutral.textDim, fontSize: 13, fontWeight: '500' as const },
  },
  {
    pill: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
    text: { color: neutral.textMid, fontSize: 13, fontWeight: '500' as const },
  },
  {
    pill: { backgroundColor: 'rgba(202,193,228,0.12)', borderColor: 'rgba(202,193,228,0.40)' },
    text: { color: secondary.lilac, fontSize: 13, fontWeight: '500' as const },
  },
  {
    pill: { backgroundColor: 'rgba(95,100,189,0.18)', borderColor: 'rgba(95,100,189,0.55)' },
    text: { color: accent.indigo, fontSize: 13, fontWeight: '500' as const },
  },
] as const;

const styles = StyleSheet.create({
  wrap: {
    flex:              1,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
    fontSize: 13,
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
