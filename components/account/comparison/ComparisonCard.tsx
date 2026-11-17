import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { neutral } from '@/theme/colors';
import { font, weight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { ComparisonRow as Row } from '@/data/account/types';
import { ComparisonRow } from './ComparisonRow';

/**
 * ComparisonCard
 * ---------------
 * The account's place on the Knox Factor leaderboard for the selected range:
 * its row, highlighted, with the two accounts above and the two below.
 *
 * One job: list the leaderboard slice.
 */
interface Props {
  rows: Row[];
}

export function ComparisonCard({ rows }: Props) {
  return (
    <AccountWidget infoText="Where this account sits on the Knox Factor leaderboard for the selected period, with its nearest neighbours. Only accounts that posted in the period are ranked.">
      <WidgetHeader kicker="By knox factor" title="Comparison" />
      {rows.length ? (
        <View style={styles.list}>
          {rows.map(row => <ComparisonRow key={row.handle} row={row} />)}
        </View>
      ) : (
        <Text style={styles.empty}>No posts in this period, so the account is not ranked.</Text>
      )}
    </AccountWidget>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.sm,
    gap:       spacing.sm,
  },
  empty: {
    marginTop:  spacing.sm,
    fontFamily: font.ui,
    fontWeight: weight.semiBold,
    fontSize:   12,
    color:      neutral.textMid,
  },
});
