import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';

/**
 * RankBadge
 * ----------
 * Compact '#N / of M' display. Renders the rank number in the supplied
 * accent colour, with the 'of M' context line below in dim text.
 *
 * Used at the account-page hero and (in a smaller variant) at the top of
 * each ScoreCard's mini-leaderboard header.
 *
 * One job: show 'where this entity sits in the overall list'.
 */

interface Props {
  rank:    number;
  total:   number;
  /** Party / accent colour for the rank number AND the border. */
  color:   string;
  /** 'lg' = hero placement (big number), 'sm' = inline header. */
  size?:   'sm' | 'lg';
}

export function RankBadge({ rank, total, color, size = 'lg' }: Props) {
  const isLg = size === 'lg';
  return (
    <View style={[styles.wrap, isLg ? styles.wrapLg : styles.wrapSm, { borderColor: color + '50' }]}>
      <DevLabel name="RankBadge" />
      <Text
        style={[isLg ? styles.numberLg : styles.numberSm, { color }]}
        numberOfLines={1}
      >
        #{rank}
      </Text>
      <Text style={styles.of} numberOfLines={1}>
        of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:        'center',
    borderWidth:       1,
    borderRadius:      radius.sm,
    backgroundColor:   'rgba(255,255,255,0.05)',
    gap:               1,
  },
  wrapLg: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  wrapSm: {
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
  },
  numberLg: { fontFamily: font.bold, fontSize: 30, lineHeight: 34 },
  numberSm: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
  of: { ...type.caption, color: neutral.textDim, fontSize: 10 } as any,
});
