import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CountUp } from '@/components/primitives/CountUp';
import { neutral, party, PartyKey } from '@/theme/colors';
import { type } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * HeadlineStat
 * -------------
 * The big number — the currently-sorted score — displayed large with a
 * label above. One job.
 */
interface Props {
  label: string;
  value: number;
  partyKey: PartyKey;
}

export function HeadlineStat({ label, value, partyKey }: Props) {
  const colour = party[partyKey];
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: neutral.textDim }]}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.row}>
        <CountUp
          value={value}
          style={[styles.value, { color: colour.glow }]}
        />
        <Text style={[styles.unit, { color: neutral.textMid }]}>/ 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...type.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  value: {
    ...type.display,
    fontSize: 48,
  },
  unit: {
    ...type.body,
    fontSize: 13,
  },
});
