import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { PostRecord } from '@/data/types';
import { fmtLabel } from '@/lib/format';
import { track } from '@/lib/analytics';

/**
 * StyleBreakdown
 * ---------------
 * Aggregates post styles across the visible feed and shows the top N as a
 * horizontal bar chart. Answers 'what style of TikToks do MPs make?' from
 * the brief without forcing the user to scroll the post feed.
 * One job: style distribution at a glance.
 */

interface Props {
  posts:           PostRecord[];
  rangeLabel?:     string;
  topN?:           number;
  /** Currently-active style filter (lowercased). When set, that row is highlighted. */
  activeStyle?:    string | null;
  /** Fired when the user taps a row. Toggles off if the same row is tapped again. */
  onStyleSelect?:  (style: string | null) => void;
}

const PALETTE = [accent.indigo, accent.mint, accent.pink, accent.amber];

export function StyleBreakdown({ posts, rangeLabel, topN = 8, activeStyle, onStyleSelect }: Props) {
  // Each row carries both the display label and the raw key — the raw key is
  // what we hand back to the parent so filters compare against post.styles
  // exactly as stored.
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const s of p.styles ?? []) {
        const key = s.trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const total = Array.from(counts.values()).reduce((s, c) => s + c, 0);
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: fmtLabel(key),
        count,
        share: total > 0 ? count / total : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }, [posts, topN]);

  const max = rows[0];
  const activeKey = activeStyle?.toLowerCase() ?? null;

  const handlePress = (key: string) => {
    const next = activeKey === key ? null : key;
    track('style_league_row_tapped', {
      style:        key,
      will_become:  next ?? 'cleared',
      result_count: posts.filter(p => (p.styles ?? []).some(s => s.toLowerCase() === key)).length,
    });
    onStyleSelect?.(next);
  };

  return (
    <DashCard
      style={styles.wrap}
      infoText="Each post is tagged with a content style during ingestion. This chart counts how often each style appears across the currently visible feed."
      infoTitle="Style Mix"
    >
      <DevLabel name="StyleBreakdown" />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>STYLE LEAGUE{rangeLabel ? ` · ${rangeLabel.toUpperCase()}` : ''}</Text>
          <Text style={styles.title}>What style of TikToks are MPs making?</Text>
          {onStyleSelect ? (
            <Text style={styles.hint}>Tap any style to filter the post feed.</Text>
          ) : null}
        </View>
        {activeKey ? (
          <Pressable onPress={() => onStyleSelect?.(null)} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear filter ×</Text>
          </Pressable>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No styles tagged in the current period yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row, i) => {
            const tint = PALETTE[i % PALETTE.length];
            const fraction = max && max.count > 0 ? row.count / max.count : 0;
            const isActive = activeKey === row.key;
            const dimmed   = activeKey != null && !isActive;
            return (
              <Pressable
                key={row.key}
                onPress={() => handlePress(row.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter posts by ${row.label}`}
                style={({ pressed, hovered }: any) => [
                  styles.row,
                  isActive && { borderColor: tint, backgroundColor: `${tint}1a` },
                  hovered && !isActive && { backgroundColor: 'rgba(255,255,255,0.03)' },
                  dimmed && { opacity: 0.55 },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={[styles.label, isActive && { color: tint }]} numberOfLines={1}>
                  {row.label}
                </Text>
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
              </Pressable>
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
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    borderWidth:       1,
    borderColor:       'transparent',
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    marginHorizontal:  -spacing.sm,
    ...Platform.select({
      web: {
        transitionProperty: 'background-color, border-color, opacity',
        transitionDuration: '160ms',
        cursor:             'pointer',
      } as any,
      default: {},
    }),
  },
  hint: {
    ...type.caption,
    color:    neutral.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  clearBtn: {
    borderWidth:       1,
    borderColor:       accent.indigo,
    backgroundColor:   'rgba(124,131,255,0.12)',
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  clearBtnText: {
    ...type.caption,
    color:    accent.indigo,
    fontSize: 12,
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
