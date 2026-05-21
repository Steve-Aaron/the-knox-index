import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { PostRecord } from '@/data/types';

/**
 * StyleBreakdown
 * ---------------
 * Aggregates post styles across the visible feed and shows the top N as a
 * horizontal bar chart. Answers 'what style of TikToks do MPs make?' from
 * the brief without forcing the user to scroll the post feed.
 * One job: style distribution at a glance.
 */

interface Props {
  posts:       PostRecord[];
  rangeLabel?: string;
  topN?:       number;
}

const PALETTE = [accent.indigo, accent.mint, accent.pink, accent.amber];

export function StyleBreakdown({ posts, rangeLabel, topN = 8 }: Props) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const key = (p.style || '').trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((s, c) => s + c, 0);
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        count,
        share: total > 0 ? count / total : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }, [posts, topN]);

  const max = rows[0];

  return (
    <DashCard style={styles.wrap}>
      <DevLabel name="StyleBreakdown" />

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>STYLE MIX{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Text>
          <Text style={styles.title}>What style of TikToks are MPs making?</Text>
        </View>
        <InfoTip
          text="Each post is tagged with a content style during ingestion. This chart counts how often each style appears across the currently visible feed."
          width={260}
        />
      </View>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No styles tagged in the current period yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row, i) => {
            const tint = PALETTE[i % PALETTE.length];
            const fraction = max && max.count > 0 ? row.count / max.count : 0;
            return (
              <View key={row.label} style={styles.row}>
                <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
                <View style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${fraction * 100}%`, backgroundColor: tint },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.value, { color: tint }]}>
                  {row.count} <Text style={styles.share}>· {Math.round(row.share * 100)}%</Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </DashCard>
  );
}

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
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 12,
    width: 110,
  },
  barWrap: {
    flex: 1,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  value: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  share: {
    color: neutral.textDim,
    fontWeight: '400',
  },
  emptyText: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
