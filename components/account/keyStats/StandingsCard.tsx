import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { CardAvatar } from '@/components/card/CardAvatar';
import { track } from '@/lib/analytics';
import { accent, colourFor, glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font, type, weight } from '@/theme/typography';
import type { KeyStatRank, StandingRow } from '@/data/account/types';

/**
 * StandingsCard
 * --------------
 * Where the account ranks by Knox Factor against comparable accounts, as a
 * short leaderboard: the account with the two ranked just above and below
 * it. A tab per peer group (party or region, party pages or other account
 * type, everyone, similar follower count). Knox Factor is one score per
 * account, the same under every period tab (as on the main leaderboard).
 * Tap a row to open that account.
 *
 * One job: show the account's place among its peers.
 */
interface Props {
  stats: KeyStatRank[];
}

export function StandingsCard({ stats }: Props) {
  const [id, setId] = useState(stats[0]?.id);
  const stat = stats.find(s => s.id === id) ?? stats[0];
  if (!stat) return null;

  const pick = (next: KeyStatRank) => {
    if (next.id === stat.id) return;
    try { track('standings_group_changed', { group: next.id, old_group: stat.id, rank: next.rank, total: next.total }); } catch {}
    setId(next.id);
  };

  return (
    <AccountWidget infoText="Where this account ranks by Knox Factor against comparable accounts, with the accounts ranked just above and below it. Politicians and parties are ranked together, as on the main leaderboard. Knox Factor does not change with the period tabs. Groups: the same party or region, the same account type, every tracked account, and accounts with between half and double its followers.">
      <WidgetHeader title="Standings" kicker="BY KNOX FACTOR" />

      <View style={styles.tabs} accessibilityRole="tablist">
        {stats.map(s => {
          const on = s.id === stat.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => pick(s)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ hovered }: any) => [styles.tab, on && styles.tabOn, hovered && !on && styles.tabHover]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{s.short.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <Text style={styles.rank}>#{stat.rank}</Text>
        <Text style={styles.total}>of {stat.total} · {stat.label.replace(/^Among /, '')}</Text>
      </View>

      <View style={styles.list}>
        {stat.neighbours.map(row => <Row key={`${stat.id}-${row.rank}`} row={row} />)}
      </View>
    </AccountWidget>
  );
}

function Row({ row }: { row: StandingRow }) {
  const colour = colourFor(row.groupKey);
  const body = (
    <>
      <Text style={[styles.rowRank, row.isTarget && styles.rowRankOn]}>{row.rank}</Text>
      <CardAvatar groupKey={row.groupKey as any} initials={row.initials} avatarUrl={row.avatarUrl} size={28} />
      <View style={styles.who}>
        <Text style={[styles.name, row.isTarget && styles.nameOn]} numberOfLines={1}>{row.name}</Text>
        <Text style={[styles.group, { color: colour.glow }]} numberOfLines={1}>{row.groupLabel}</Text>
      </View>
      <Text style={[styles.score, row.isTarget && { color: colour.glow }]}>{row.knoxFactor}</Text>
    </>
  );

  if (row.isTarget) {
    return <View style={[styles.row, styles.rowOn, { borderColor: colour.base }]}>{body}</View>;
  }
  return (
    <Pressable
      onPress={() => router.push(`/account/${row.slug}`)}
      accessibilityRole="link"
      accessibilityLabel={`${row.name}, rank ${row.rank}, Knox Factor ${row.knoxFactor}, open account`}
      style={({ hovered, pressed }: any) => [styles.row, hovered && styles.rowHover, pressed && { opacity: 0.8 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
  },
  tab: {
    paddingVertical:   5,
    paddingHorizontal: 10,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  tabOn: {
    backgroundColor: 'rgba(95,100,189,0.18)',
    borderColor:     accent.indigo,
  },
  tabHover: {
    backgroundColor: glass.fillHi,
  },
  tabText: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 0.8,
    color:         neutral.textDim,
  },
  tabTextOn: {
    color: neutral.text,
  },
  summary: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  rank: {
    fontFamily: font.mono,
    fontWeight: weight.bold,
    fontSize:   32,
    color:      neutral.text,
  },
  total: {
    ...type.body,
    fontSize: 12,
    color:    neutral.textMid,
    flexShrink: 1,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingVertical:   6,
    paddingHorizontal: 8,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       'transparent',
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  rowOn: {
    backgroundColor: glass.card,
    ...Platform.select({ web: { cursor: 'default' } as any, default: {} }),
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowRank: {
    fontFamily: font.mono,
    fontSize:   12,
    color:      neutral.textDim,
    minWidth:   24,
  },
  rowRankOn: {
    color: neutral.text,
  },
  who: {
    flex:     1,
    minWidth: 0,
  },
  name: {
    ...type.body,
    fontSize: 13,
    color:    neutral.textMid,
  },
  nameOn: {
    color:      neutral.text,
    fontWeight: weight.bold,
  },
  group: {
    ...type.caption,
    fontSize: 10,
  },
  score: {
    fontFamily: font.mono,
    fontWeight: weight.bold,
    fontSize:   14,
    color:      neutral.textMid,
  },
});
