import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { RankBoardRow } from './RankBoardRow';
import { neutral } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician, ScoreKey } from '@/data/types';

/**
 * RankBoard
 * ----------
 * Sidekick widget to the main card. Lists all politicians ranked by the
 * current sort key. Clicking a row focuses that politician on the main card.
 * Uses a ScrollView so long lists don't overflow the fixed panel height.
 * One job: rank + select.
 */
interface Props {
  politicians:    Politician[];
  activeId:       string;
  headlineKey:    ScoreKey;
  timeRangeLabel: string;
  onSelect:       (id: string) => void;
  panelHeight?:   number;
}

const LABELS: Record<ScoreKey, string> = {
  views:       'Views',
  frequency:   'Frequency',
  engagement:  'Engagement',
  followers:   'Followers',
  knoxFactor:  'Knox Factor',
};

export function RankBoard({ politicians, activeId, headlineKey, timeRangeLabel, onSelect, panelHeight }: Props) {
  const ranked = useMemo(
    () => [...politicians].sort((a, b) => b.scores[headlineKey] - a.scores[headlineKey]),
    [politicians, headlineKey]
  );

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  return (
    <GlassSurface style={wrapStyle} radius={radius.lg}>
      <DevLabel name="RankBoard" />

      {/* Fixed header — stays at the top */}
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>LEADERBOARD</Text>
          <InfoTip text="Politicians ranked from highest to lowest by the selected score. Tap any row to see their full profile and recent posts in the panel to the right." />
        </View>
        <Text style={styles.title}>Top {ranked.length}</Text>
        <Text style={styles.meta}>
          Ranked by {LABELS[headlineKey]} · {timeRangeLabel}
        </Text>
      </View>

      {/* Scrollable list — fills remaining height */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {ranked.length === 0
          ? [52, 52, 52, 52, 52, 52].map((h, i) => (
              <SkeletonBlock key={i} height={h} borderRadius={14} />
            ))
          : ranked.map((p, i) => (
              <RankBoardRow
                key={p.id}
                politician={p}
                rank={i + 1}
                headlineKey={headlineKey}
                active={p.id === activeId}
                onPress={() => onSelect(p.id)}
              />
            ))
        }
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { ...type.caption, color: neutral.textDim, fontSize: 10 },
  title:  { ...type.title, color: neutral.text, fontSize: 20, marginTop: 2 },
  meta:   { ...type.body, color: neutral.textMid, fontSize: 12 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
