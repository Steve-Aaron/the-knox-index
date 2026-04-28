import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { RankBoardRow } from './RankBoardRow';
import { neutral, glass, party } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician, ScoreKey } from '@/data/types';

const PARTY_LABELS: Partial<Record<PartyKey, string>> = {
  labour: 'Labour', conservative: 'Conservative', libdem: 'Lib Dem',
  snp: 'SNP', green: 'Greens', reform: 'Reform', plaid: 'Plaid',
  dup: 'DUP', sinnfein: 'Sinn Féin', independent: 'Independent', unknown: 'Unknown',
};

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
  const [partyFilter, setPartyFilter] = useState<PartyKey | null>(null);

  const partyOptions = useMemo<PartyKey[]>(() => {
    const seen = new Set<PartyKey>();
    politicians.forEach(p => seen.add(p.partyKey));
    return Array.from(seen).sort();
  }, [politicians]);

  const ranked = useMemo(() => {
    const base = partyFilter
      ? politicians.filter(p => p.partyKey === partyFilter)
      : politicians;
    return [...base].sort((a, b) => b.scores[headlineKey] - a.scores[headlineKey]);
  }, [politicians, headlineKey, partyFilter]);

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
          <InfoTip text="Politicians ranked from highest to lowest by the selected score. Tap any row to see their full profile and recent posts in the panel to the right. Use the party chips to scope the leaderboard to a single party." />
        </View>
        <Text style={styles.title}>Top {ranked.length}</Text>
        <Text style={styles.meta}>
          Ranked by {LABELS[headlineKey]} · {timeRangeLabel}
          {partyFilter ? ` · ${PARTY_LABELS[partyFilter] ?? partyFilter}` : ''}
        </Text>

        {partyOptions.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.partyRow}
          >
            <Pressable
              onPress={() => setPartyFilter(null)}
              style={({ pressed }) => [
                styles.partyChip,
                partyFilter === null && styles.partyChipAll,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.partyChipText, partyFilter === null && styles.partyChipTextAll]}>
                All
              </Text>
            </Pressable>
            {partyOptions.map(pk => {
              const colour = party[pk];
              const active = partyFilter === pk;
              return (
                <Pressable
                  key={pk}
                  onPress={() => setPartyFilter(active ? null : pk)}
                  style={({ pressed }) => [
                    styles.partyChip,
                    active && { borderColor: colour.base, backgroundColor: colour.base + '22' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={[styles.partyDot, { backgroundColor: colour.base }]} />
                  <Text style={[styles.partyChipText, active && { color: colour.glow }]}>
                    {PARTY_LABELS[pk] ?? pk}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Scrollable list — fills remaining height */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {ranked.length === 0
          ? politicians.length === 0
            ? [52, 52, 52, 52, 52, 52].map((h, i) => (
                <SkeletonBlock key={i} height={h} borderRadius={14} />
              ))
            : <Text style={styles.emptyText}>No accounts match the current filter.</Text>
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
  partyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  partyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
  },
  partyChipAll: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  partyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  partyChipText: {
    ...type.caption,
    fontSize: 9,
    color: neutral.textMid,
  },
  partyChipTextAll: {
    color: neutral.text,
  },
  emptyText: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingTop: spacing.lg,
  },
});
