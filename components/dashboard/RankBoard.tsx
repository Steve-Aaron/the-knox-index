import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { RankBoardRow } from './RankBoardRow';
import { ViewTabs, VIEW_ACCOUNT_TYPES, type ViewType } from './ViewTabs';
import { neutral, glass, party, brand } from '@/theme/colors';
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
  /** When true, all rows are visible. When false, rows 6+ are blurred and non-interactive. */
  isRegistered?:  boolean;
}

const LABELS: Record<ScoreKey, string> = {
  views:       'Views',
  frequency:   'Frequency',
  engagement:  'Engagement',
  followers:   'Followers',
  knoxFactor:  'Knox Factor',
};

export function RankBoard({ politicians, activeId, headlineKey, timeRangeLabel, onSelect, panelHeight, isRegistered = false }: Props) {
  const [viewType, setViewType]       = useState<ViewType>('all');
  const [partyFilter, setPartyFilter] = useState<PartyKey | null>(null);

  // Counts per view type for the tab badges.
  // VIEW_ACCOUNT_TYPES maps each tab to its included AccountType values.
  // 'all' has no entry, so the full array length is used directly.
  const counts = useMemo<Partial<Record<ViewType, number>>>(() => {
    const countFor = (v: ViewType) => {
      const types = VIEW_ACCOUNT_TYPES[v];
      if (!types) return politicians.length;
      return politicians.filter(p => p.accountTypes?.some(t => types.includes(t))).length;
    };
    return {
      all:                  politicians.length,
      member_of_parliament: countFor('member_of_parliament'),
      political_party:      countFor('political_party'),
      party_leader:         countFor('party_leader'),
      cabinet_minister:     countFor('cabinet_minister'),
      senior_politicians:   countFor('senior_politicians'),
    };
  }, [politicians]);

  const partyOptions = useMemo<PartyKey[]>(() => {
    const types = VIEW_ACCOUNT_TYPES[viewType];
    const base = types ? politicians.filter(p => p.accountTypes?.some(t => types.includes(t))) : politicians;
    const seen = new Set<PartyKey>();
    base.forEach(p => seen.add(p.partyKey));
    return Array.from(seen).sort();
  }, [politicians, viewType]);

  // Reset party filter when view type changes.
  function handleViewChange(v: ViewType) {
    setViewType(v);
    setPartyFilter(null);
  }

  const ranked = useMemo(() => {
    const types = VIEW_ACCOUNT_TYPES[viewType];
    let base = types ? politicians.filter(p => p.accountTypes?.some(t => types.includes(t))) : politicians;
    // Only include accounts that posted at least once in the selected range.
    base = base.filter(p => p.totals.postsInRange > 0);
    if (partyFilter) base = base.filter(p => p.partyKey === partyFilter);
    return [...base].sort((a, b) => b.scores[headlineKey] - a.scores[headlineKey]);
  }, [politicians, headlineKey, viewType, partyFilter]);

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  return (
    <DashCard style={wrapStyle}>
      <DevLabel name="RankBoard" />

      {/* Fixed header — stays at the top */}
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>LEADERBOARD</Text>
          <InfoTip text="Politicians ranked from highest to lowest by the selected score. Tap any row to see their full profile and recent posts in the panel to the right. Use the party chips to scope the leaderboard to a single party." />
        </View>
        <Text style={styles.title}>The Leaderboard</Text>
        <Text style={styles.meta}>
          {timeRangeLabel}
          {' · '}
          {ranked.reduce((sum, p) => sum + p.totals.postsInRange, 0)} posts by {ranked.filter(p => p.totals.postsInRange > 0).length} accounts
          {partyFilter ? ` · ${PARTY_LABELS[partyFilter] ?? partyFilter}` : ''}
        </Text>

        {/* Account-type tabs — MPs / Parties / Councils / All */}
        <View style={styles.viewTabsWrap}>
          <ViewTabs value={viewType} onChange={handleViewChange} counts={counts} />
        </View>

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
          : ranked.map((p, i) => {
              const blurred = !isRegistered && i >= 5;
              const row = (
                <RankBoardRow
                  key={p.id}
                  politician={p}
                  rank={i + 1}
                  headlineKey={headlineKey}
                  active={p.id === activeId}
                  onPress={() => onSelect(p.id)}
                />
              );
              if (!blurred) return row;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.blurWrap,
                    Platform.select({
                      web: { filter: 'blur(3px)', opacity: 0.55 } as any,
                      default: { opacity: 0.2 },
                    }),
                  ]}
                  pointerEvents="none"
                >
                  {row}
                </View>
              );
            })
        }
      </ScrollView>
    </DashCard>
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
  kicker: { ...type.caption, color: neutral.textDim, fontSize: 12 },
  title:  { ...type.title, color: neutral.text, fontSize: 20, marginTop: 2 },
  meta:   { ...type.body, color: neutral.textMid, fontSize: 12 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  viewTabsWrap: {
    marginTop: spacing.sm,
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
    fontSize: 12,
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
  blurWrap: {
    // Platform-specific blur applied inline via Platform.select in the JSX.
    // This style provides only layout — no visual properties here.
    userSelect: 'none' as any,
  },
});
