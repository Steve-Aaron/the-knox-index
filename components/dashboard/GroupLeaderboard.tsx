import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, party, brand, colourFor } from '@/theme/colors';
import type { GroupKey } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { formatters } from '@/components/primitives/CountUp';
import { track } from '@/lib/analytics';
import type { Politician } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import { useTenant } from '@/hooks/useTenant';
import { labelForGroupKey } from '@/data/grouping';

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
  week:      'LAST 7 DAYS',
  month:     'LAST 30 DAYS',
  year:      'THIS YEAR',
  lifetime:  'ALL TIME',
};

/**
 * GroupLeaderboard
 * -----------------
 * Aggregates account-level numbers up to the tenant's grouping level — party
 * on The Knox Index, region on World Leaders — so the reader can see at a
 * glance which group is doing best or is most active on TikTok.
 *
 * The maths, sorting and bar rendering are identical for both; only the labels
 * and the copy come from the tenant (lib/tenants.ts).
 *
 * One job: group-level ranking, sortable by views / posts / engagement.
 */

type SortKey = 'views' | 'postsThisWeek' | 'engagement' | 'accounts';

interface Props {
  politicians:    Politician[];
  range?:         TimeRange;
  onGroupSelect?: (groupKey: GroupKey | null) => void;
  activeGroup?:   GroupKey | null;
}

interface GroupRow {
  key:            GroupKey;
  label:          string;
  accounts:       number;
  totalViews:     number;   // views in selected range (from post table)
  totalPosts:     number;   // posts in selected range
  engagementRate: number;   // (likes + comments + saves + shares) / views in range × 100
}

const SORT_OPTIONS: { key: SortKey; label: string; tip: string }[] = [
  { key: 'views',         label: 'Views',      tip: 'Total views for this period, summed across every tracked account in the group.' },
  { key: 'postsThisWeek', label: 'Activity',   tip: 'Total posts published in this period from every tracked account in the group.' },
  { key: 'engagement',    label: 'Engagement', tip: 'Average engagement rate (likes + comments + saves + shares ÷ views) across all posts in this period.' },
  { key: 'accounts',      label: 'Accounts',   tip: 'Number of distinct tracked accounts in the group.' },
];

const PARTY_LABELS: Partial<Record<GroupKey, string>> = {
  labour:       'Labour',
  conservative: 'Conservative',
  libdem:       'Lib Dem',
  snp:          'SNP',
  green:        'Greens',
  reform:       'Reform',
  plaid:        'Plaid',
  dup:          'DUP',
  sinnfein:     'Sinn Féin',
  alliance:     'Alliance',
  sdlp:         'SDLP',
  uup:          'UUP',
  tuv:          'TUV',
  workers:      'Workers Party',
  advance:      'Advance UK',
  restore:      'Restore Britain',
  yourparty:    'Your Party',
  independent:  'Independent',
  unknown:      'Unknown',
};

export function GroupLeaderboard({ politicians, range = 'week', onGroupSelect, activeGroup }: Props) {
  const tenant = useTenant();
  const mode   = tenant.grouping.mode;
  const [sortKey, setSortKey] = useState<SortKey>('engagement');
  const postsPeriodLabel = POSTS_PERIOD[range];
  const rangeKicker = RANGE_KICKER[range];

  const rows = useMemo<GroupRow[]>(() => {
    const buckets = new Map<GroupKey, Politician[]>();
    for (const p of politicians) {
      const bucket = buckets.get(p.groupKey) ?? [];
      bucket.push(p);
      buckets.set(p.groupKey, bucket);
    }

    const out: GroupRow[] = [];
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
      // Parties with zero posts in the selected range carry no signal —
      // omit them rather than rendering a row of zeros.
      if (totalPosts === 0) continue;

      out.push({
        key,
        // Party mode keeps the hand-written short labels ('Lib Dem', 'Sinn Féin');
        // every other mode resolves its label from the grouping adapter.
        label:          (mode === 'party' ? PARTY_LABELS[key] : undefined) ?? labelForGroupKey(mode, key),
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
  }, [politicians, sortKey, mode]);

  const max = rows[0];

  return (
    <DashCard
      style={styles.wrap}
      infoText={tenant.grouping.boardInfo}
      infoTitle={`${tenant.grouping.label} League`}
    >
      <DevLabel name="GroupLeaderboard" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Kicker tone='dim'>{tenant.grouping.boardKicker} · {rangeKicker}</Kicker>
            <Title style={{ fontSize: 20, marginTop: 2 }}>{tenant.grouping.boardQuestion}</Title>
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
          <Text style={styles.emptyText}>No {tenant.grouping.label.toLowerCase()} data available yet.</Text>
        ) : rows.map((row, i) => {
          const colour = colourFor(row.key);
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

          const isActive = activeGroup === row.key;

          return (
            <Pressable
              key={row.key}
              onPress={() => {
                // Event name kept for continuity of the existing Mixpanel
                // reports; `group_mode` says whether it was a party or a region.
                track('party_leaderboard_row_tapped', {
                  group_mode:      mode,
                  party_key:       row.key,
                  party_label:     row.label,
                  rank:            i + 1,
                  sort_key:        sortKey,
                  total_views:     row.totalViews,
                  total_posts:     row.totalPosts,
                  engagement_rate: +row.engagementRate.toFixed(2),
                });
                // Toggle: tap the same row again to clear the filter
                onGroupSelect?.(isActive ? null : row.key);
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
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               spacing.md,
  },
  header: {
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  // Lets the heading shrink and wrap instead of forcing the row wider.
  // minWidth:0 is the web flexbox fix that allows text to wrap inside a flex row.
  titleBlock: {
    flexShrink: 1,
    minWidth: 0 as any,
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
    backgroundColor: 'rgba(95,100,189,0.16)',
    borderColor: 'rgba(95,100,189,0.5)',
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
