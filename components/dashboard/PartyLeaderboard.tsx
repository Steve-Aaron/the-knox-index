import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass, party, brand } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { formatters } from '@/components/primitives/CountUp';
import { track } from '@/lib/analytics';
import type { Politician } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/** Short label for the activity meta line on each row. */
const POSTS_PERIOD: Record<TimeRange, string> = {
  yesterday: 'posts / day',
  week:      'posts / wk',
  month:     'posts / mo',
  year:      'posts / yr',
  lifetime:  'posts',
};

/** Kicker suffix per range. */
const RANGE_KICKER: Record<TimeRange, string> = {
  yesterday: 'YESTERDAY',
  week:      'THIS WEEK',
  month:     'THIS MONTH',
  year:      'THIS YEAR',
  lifetime:  'ALL TIME',
};

/**
 * PartyLeaderboard
 * -----------------
 * Aggregates politician-level numbers up to the party level so the user can
 * see at a glance which party is doing best or is most active on TikTok.
 * One job: party-level ranking, sortable by views / posts / engagement.
 */

type SortKey = 'views' | 'postsThisWeek' | 'engagement' | 'accounts';

interface Props {
  politicians:    Politician[];
  range?:         TimeRange;
  onPartySelect?: (partyKey: PartyKey | null) => void;
  activeParty?:   PartyKey | null;
}

interface PartyRow {
  key:            PartyKey;
  label:          string;
  accounts:       number;
  totalViews:     number;   // views in selected range (from post table)
  totalPosts:     number;   // posts in selected range
  engagementRate: number;   // (likes + comments + saves + shares) / views in range × 100
}

const SORT_OPTIONS: { key: SortKey; label: string; tip: string }[] = [
  { key: 'views',         label: 'Views',      tip: 'Total views for this period, summed across every tracked account in the party.' },
  { key: 'postsThisWeek', label: 'Activity',   tip: 'Total posts published in this period from every tracked account in the party.' },
  { key: 'engagement',    label: 'Engagement', tip: 'Average engagement rate (likes + comments + saves + shares ÷ views) across all posts in this period.' },
  { key: 'accounts',      label: 'Accounts',   tip: 'Number of distinct tracked accounts in the party.' },
];

const PARTY_LABELS: Partial<Record<PartyKey, string>> = {
  labour:       'Labour',
  conservative: 'Conservative',
  libdem:       'Lib Dem',
  snp:          'SNP',
  green:        'Greens',
  reform:       'Reform',
  plaid:        'Plaid',
  dup:          'DUP',
  sinnfein:     'Sinn Féin',
  independent:  'Independent',
  unknown:      'Unknown',
};

export function PartyLeaderboard({ politicians, range = 'week', onPartySelect, activeParty }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const postsPeriodLabel = POSTS_PERIOD[range];
  const rangeKicker = RANGE_KICKER[range];

  const rows = useMemo<PartyRow[]>(() => {
    const buckets = new Map<PartyKey, Politician[]>();
    for (const p of politicians) {
      const bucket = buckets.get(p.partyKey) ?? [];
      bucket.push(p);
      buckets.set(p.partyKey, bucket);
    }

    const out: PartyRow[] = [];
    for (const [key, members] of buckets) {
      // Use range-specific aggregates from the post table — these are always
      // populated (coalesced to 0 in SQL) and reflect the selected time window.
      const totalViews    = members.reduce((s, p) => s + p.totals.viewsInRange,    0);
      const totalLikes    = members.reduce((s, p) => s + p.totals.likesInRange,    0);
      const totalComments = members.reduce((s, p) => s + p.totals.commentsInRange, 0);
      const totalSaves    = members.reduce((s, p) => s + p.totals.savesInRange,    0);
      const totalShares   = members.reduce((s, p) => s + p.totals.sharesInRange,   0);
      const totalPosts    = members.reduce((s, p) => s + p.totals.postsInRange,    0);
      const engagementRate = totalViews > 0
        ? ((totalLikes + totalComments + totalSaves + totalShares) / totalViews) * 100
        : 0;
      out.push({
        key,
        label:          PARTY_LABELS[key] ?? key,
        accounts:       members.length,
        totalViews,
        totalPosts,
        engagementRate,
      });
    }

    return out.sort((a, b) => {
      switch (sortKey) {
        case 'views':         return b.totalViews     - a.totalViews;
        case 'postsThisWeek': return b.totalPosts     - a.totalPosts;
        case 'engagement':    return b.engagementRate - a.engagementRate;
        case 'accounts':      return b.accounts       - a.accounts;
      }
    });
  }, [politicians, sortKey]);

  const max = rows[0];

  return (
    <DashCard
      style={styles.wrap}
      infoText="Politicians grouped by party and totalled. Use this to answer 'which party is dominating TikTok this week' and 'which party is most active'. Tap a party row to filter the post feed below."
      infoTitle="Party League"
    >
      <DevLabel name="PartyLeaderboard" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.kicker}>PARTY LEAGUE · {rangeKicker}</Text>
            <Text style={styles.title}>Who's winning the parties' war?</Text>
          </View>
        </View>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(s => {
            const active = s.key === sortKey;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSortKey(s.key)}
                style={({ pressed }) => [
                  styles.sortChip,
                  active && styles.sortChipActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>No party data available yet.</Text>
        ) : rows.map((row, i) => {
          const colour = party[row.key];
          const denom = sortKey === 'views' ? max.totalViews
                      : sortKey === 'postsThisWeek' ? max.totalPosts
                      : sortKey === 'engagement' ? Math.max(max.engagementRate, 0.0001)
                      : max.accounts;
          const headlineValue = sortKey === 'views' ? row.totalViews
                              : sortKey === 'postsThisWeek' ? row.totalPosts
                              : sortKey === 'engagement' ? row.engagementRate
                              : row.accounts;
          const barFraction = denom > 0 ? Math.max(0, Math.min(1, headlineValue / denom)) : 0;
          const headlineText = sortKey === 'engagement'
            ? `${row.engagementRate.toFixed(2)}%`
            : formatters.compact(headlineValue);

          const isActive = activeParty === row.key;

          return (
            <Pressable
              key={row.key}
              onPress={() => {
                track('party_leaderboard_row_tapped', {
                  party_key:       row.key,
                  party_label:     row.label,
                  rank:            i + 1,
                  sort_key:        sortKey,
                  total_views:     row.totalViews,
                  total_posts:     row.totalPosts,
                  engagement_rate: +row.engagementRate.toFixed(2),
                });
                // Toggle: tap the same party again to clear the filter
                onPartySelect?.(isActive ? null : row.key);
              }}
              style={({ pressed, hovered }: any) => [
                styles.row,
                isActive && { backgroundColor: colour.base + '18', borderRadius: 8 },
                hovered && !isActive && { backgroundColor: 'rgba(255,255,255,0.03)' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.rank, isActive && { color: colour.glow }]}>{i + 1}</Text>
              <View style={[styles.partyDot, { backgroundColor: colour.base }]} />
              <View style={styles.rowMain}>
                <View style={styles.rowTopLine}>
                  <Text style={styles.partyName}>{row.label}</Text>
                  <Text style={[styles.headlineValue, { color: colour.glow }]}>
                    {headlineText}
                  </Text>
                </View>

                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${barFraction * 100}%`, backgroundColor: colour.base },
                    ]}
                  />
                </View>

                <View style={styles.rowMeta}>
                  <Text style={styles.metaText}>{row.accounts} accounts</Text>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>{formatters.compact(row.totalPosts)} {postsPeriodLabel}</Text>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>{row.engagementRate.toFixed(2)}% eng</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
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
    gap: spacing.sm,
  },
  titleRow: {
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
    fontSize: 20,
    marginTop: 2,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  sortChipActive: {
    backgroundColor: 'rgba(124,131,255,0.16)',
    borderColor: 'rgba(124,131,255,0.5)',
  },
  sortChipText: {
    ...type.caption,
    fontSize: 12,
    color: neutral.textMid,
  },
  sortChipTextActive: {
    color: neutral.text,
  },
  list: {
    gap: spacing.sm,
  },
  emptyText: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '150ms' } as any, default: {} }),
  },
  rank: {
    fontFamily: font.mono,
    color: neutral.textDim,
    fontSize: 12,
    width: 18,
    textAlign: 'right',
  },
  partyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  partyName: {
    ...type.body,
    color: neutral.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headlineValue: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  metaDivider: {
    color: neutral.textDim,
    fontSize: 12,
  },
});
