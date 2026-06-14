import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { RankBoardRow } from './RankBoardRow';
import { ViewTabs, VIEW_ACCOUNT_TYPES, type ViewType } from './ViewTabs';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, party, brand, knox } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { Politician, ScoreKey, LeaderboardSortKey } from '@/data/types';
import { leaderboardScore, viralityRatioFor, engagementRate } from '@/data/leaderboard';

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
  headlineKey:    LeaderboardSortKey;
  timeRangeLabel: string;
  onSelect:       (id: string) => void;
  panelHeight?:   number;
  /** When true, all rows are visible. When false, rows 6+ are blurred and non-interactive. */
  isRegistered?:  boolean;
  /**
   * True when the 'Lifetime' time filter is active. When false, Knox Factor
   * ranking/display uses the range-scoped score (posts in the selected
   * period only). Defaults to true so untouched callers keep lifetime Knox.
   */
  isLifetime?:    boolean;
  /** Engagement display reference rate (%). The engagement column tops out at
   *  min(this, 15%). Passed from the dashboard's current set. */
  engReference?:  number;
}

const LABELS: Record<ScoreKey, string> = {
  virality:    'Virality',
  frequency:   'Frequency',
  engagement:  'Engagement',
  followers:   'Followers',
  knoxFactor:  'Knox Factor',
};

export function RankBoard({ politicians, activeId, headlineKey, timeRangeLabel, onSelect, panelHeight, isRegistered = false, isLifetime = true, engReference = 15 }: Props) {
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
    // Order chips by party size (account count) descending, so the largest
    // parties lead and one-account fringe parties fall to the end.
    // Alphabetical tie-break keeps the order stable.
    const counts = new Map<PartyKey, number>();
    base.forEach(p => counts.set(p.partyKey, (counts.get(p.partyKey) ?? 0) + 1));
    return Array.from(counts.keys()).sort((a, b) => {
      const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
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
    // Knox Factor is range-scoped when a time filter is active (leaderboardScore).
    // Virality clamps many accounts to the same score, so break ties by true
    // reach-per-follower — a higher-reach account can never sit below a lower one.
    return [...base].sort((a, b) => {
      // Engagement is now a filter-scaled display score: sort by the raw rate
      // (monotonic with the score) so order matches the displayed value.
      if (headlineKey === 'engagement') {
        const e = engagementRate(b) - engagementRate(a);
        if (e !== 0) return e;
      }
      const d = leaderboardScore(b, headlineKey, isLifetime) - leaderboardScore(a, headlineKey, isLifetime);
      if (d !== 0) return d;
      if (headlineKey === 'virality') return viralityRatioFor(b, isLifetime) - viralityRatioFor(a, isLifetime);
      // Followers clamps many accounts to the same /100 — break ties by raw
      // follower count so a bigger account can never sit below a smaller one.
      if (headlineKey === 'followers') return b.totals.followers - a.totals.followers;
      return 0;
    });
  }, [politicians, headlineKey, viewType, partyFilter, isLifetime]);

  // Top page's views in the current list — the 100/100 reference for the
  // views display score (each halving below it drops 10 points).
  const viewsMax = useMemo(
    () => ranked.reduce((m, p) => Math.max(m, p.totals.viewsInRange), 0),
    [ranked],
  );

  const wrapStyle = {
    flex: 1 as const,
    overflow: 'hidden' as const,
    ...(panelHeight != null ? { height: panelHeight } : {}),
  };

  return (
    <DashCard
      style={wrapStyle}
      infoText="Politicians ranked from highest to lowest by the selected score. Tap any row to see their full profile and recent posts in the panel to the right. Use the party chips to scope the leaderboard to a single party."
      infoTitle="Leaderboard"
    >
      <DevLabel name="RankBoard" />

      {/* Fixed header — stays at the top */}
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Kicker tone='dim'>LEADERBOARD</Kicker>
        </View>
        <Title style={{ fontSize: 20, marginTop: 2 }}>The Leaderboard</Title>
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
          : (() => {
              // Split into visible (top 5 for guests, all for registered users)
              // and locked rows so the registration prompt can sit over the
              // blurred block instead of being inlined awkwardly between rows.
              const cutoff = isRegistered ? ranked.length : Math.min(5, ranked.length);
              const visible = ranked.slice(0, cutoff);
              const locked  = isRegistered ? [] : ranked.slice(cutoff);

              return (
                <>
                  {visible.map((p, i) => (
                    <RankBoardRow
                      key={p.id}
                      politician={p}
                      rank={i + 1}
                      headlineKey={headlineKey}
                      isLifetime={isLifetime}
                      viewsMax={viewsMax}
                      engReference={engReference}
                      active={p.id === activeId}
                      onPress={() => onSelect(p.id)}
                    />
                  ))}

                  {locked.length > 0 && (
                    <View style={styles.lockedSection} pointerEvents="box-none">
                      {/* Blurred placeholder rows — give the overlay something
                          to sit on top of so the prompt feels tied to the data
                          it's hiding rather than floating in empty space. */}
                      <View
                        style={[
                          styles.lockedRows,
                          Platform.select({
                            web: { filter: 'blur(3px)', opacity: 0.55 } as any,
                            default: { opacity: 0.2 },
                          }),
                        ]}
                        pointerEvents="none"
                      >
                        {locked.map((p, i) => (
                          <RankBoardRow
                            key={p.id}
                            politician={p}
                            rank={cutoff + i + 1}
                            headlineKey={headlineKey}
                            isLifetime={isLifetime}
                            viewsMax={viewsMax}
                            engReference={engReference}
                            active={false}
                            onPress={() => undefined}
                          />
                        ))}
                      </View>

                      {/* Centered prompt — absolutely positioned over the blur */}
                      <View style={styles.lockedOverlay} pointerEvents="box-none">
                        <View style={styles.lockedPromptCard}>
                          <Text style={styles.lockedKicker}>LOCKED</Text>
                          <Text style={styles.lockedTitle}>
                            Register to see all {ranked.length} politicians
                          </Text>
                          <Text style={styles.lockedBody}>
                            Unlock the full leaderboard, filter by party and political alignment, and access every post.
                          </Text>
                          <View style={styles.lockedButton}>
                            <Text style={styles.lockedButtonText}>SCROLL DOWN TO REGISTER ↓</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              );
            })()
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

  // ── Locked / registration overlay ────────────────────────────────────────
  lockedSection: {
    position:  'relative',
    minHeight: 220,
    marginTop: spacing.sm,
  },
  lockedRows: {
    gap: spacing.sm,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing.md,
  },
  lockedPromptCard: {
    backgroundColor:   'rgba(31,29,29,0.92)',
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.lg,
    gap:               6,
    maxWidth:          340,
    alignItems:        'center',
    ...Platform.select({
      web: {
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:            '0 16px 48px rgba(232,60,145,0.28)',
      } as any,
      default: {
        shadowColor:   knox.primaryPink,
        shadowOpacity: 0.4,
        shadowRadius:  24,
        shadowOffset:  { width: 0, height: 8 },
      },
    }),
  },
  lockedKicker: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         knox.primaryPink,
    letterSpacing: 2,
  },
  lockedTitle: {
    fontFamily: font.bold,
    fontSize:   18,
    color:      neutral.text,
    textAlign:  'center',
    lineHeight: 22,
  },
  lockedBody: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
    lineHeight: 17,
    textAlign:  'center',
    marginTop:  4,
  },
  lockedButton: {
    marginTop:         spacing.sm,
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    backgroundColor:   'rgba(232,60,145,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  lockedButtonText: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         knox.primaryPink,
    letterSpacing: 1.2,
  },
});
