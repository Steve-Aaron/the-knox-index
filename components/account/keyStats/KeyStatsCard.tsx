import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { knox } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { KeyStatRank } from '@/data/account/types';
import { RankStatRow } from './RankStatRow';

/**
 * KeyStatsCard
 * -------------
 * Where the account ranks inside its peer groups (same type, similar
 * follower count, same party — or same region on region-grouped dashboards).
 *
 * One job: list the peer-group ranks.
 */
interface Props {
  stats: KeyStatRank[];
}

/** Accent per row, cycled. */
const ROW_COLORS = [knox.primaryPink, knox.primaryOrange, knox.secondaryOrange] as const;

export function KeyStatsCard({ stats }: Props) {
  return (
    <AccountWidget infoText="How this account ranks by Knox Factor against comparable accounts: the same account type, a similar follower count, and the same party or region.">
      <WidgetHeader title="Key stats" />
      <View style={styles.list}>
        {stats.map((stat, i) => (
          <RankStatRow key={stat.id} stat={stat} color={ROW_COLORS[i % ROW_COLORS.length]} />
        ))}
      </View>
    </AccountWidget>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
