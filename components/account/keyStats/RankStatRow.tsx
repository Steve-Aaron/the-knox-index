import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { font, type, weight } from '@/theme/typography';
import type { KeyStatRank } from '@/data/account/types';

/**
 * RankStatRow
 * ------------
 * One peer-group ranking: accent bar, label, '#16', 'out of 55 accounts'.
 *
 * One job: render a single rank.
 */
interface Props {
  stat:  KeyStatRank;
  color: string;
}

export function RankStatRow({ stat, color }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={styles.label}>{stat.label}</Text>
        <Text style={[styles.rank, { color }]}>#{stat.rank}</Text>
        <Text style={styles.total}>out of {stat.total} accounts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    gap:             spacing.md,
    padding:         spacing.base,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.card,
  },
  bar: {
    width:        2,
    borderRadius: 1,
  },
  body: {
    flex: 1,
    gap:  2,
  },
  label: {
    ...type.caption,
    fontSize: 12,
    color:    neutral.text,
  },
  rank: {
    fontFamily: font.ui,
    fontWeight: weight.bold,
    fontSize:   16,
  },
  total: {
    ...type.body,
    fontSize: 12,
    color:    neutral.textMid,
  },
});
