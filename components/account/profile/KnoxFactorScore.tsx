import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CountUp } from '@/components/primitives/CountUp';
import { InfoTip } from '@/components/primitives/InfoTip';
import { Kicker } from '@/components/ui/Kicker';
import { accent, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type, weight } from '@/theme/typography';
import type { KnoxFactorSnapshot } from '@/data/account/types';

/**
 * KnoxFactorScore
 * ----------------
 * '84 /100' headline with the 'KNOX FACTOR NOW' label and a week-on-week
 * trend line underneath.
 *
 * One job: present the current Knox Factor and its direction.
 */
interface Props {
  knoxFactor: KnoxFactorSnapshot;
  /** Score colour — the account's group glow. */
  color:      string;
}

function trendCopy(delta: number): string {
  if (delta === 0) return 'No change vs prev. week';
  const points = Math.abs(delta) === 1 ? 'point' : 'points';
  return `${Math.abs(delta)} ${points} ${delta > 0 ? 'higher' : 'lower'} vs prev. week`;
}

export function KnoxFactorScore({ knoxFactor, color }: Props) {
  const { score, deltaVsPrev } = knoxFactor;
  const trendColor = deltaVsPrev > 0 ? accent.mint : deltaVsPrev < 0 ? accent.amber : neutral.textMid;
  const arrow = deltaVsPrev > 0 ? '↗' : deltaVsPrev < 0 ? '↘' : '→';

  return (
    <View style={styles.wrap}>
      <View style={styles.scoreRow}>
        <CountUp value={score} style={[styles.score, { color }]} />
        <Text style={styles.outOf}>/100</Text>
      </View>

      <View style={styles.labelRow}>
        <Kicker tone="dim">Knox Factor now</Kicker>
        <InfoTip text="Our composite 0–100 rating of how well this account is performing across reach, engagement, activity and audience size." />
      </View>

      <Text style={styles.trend}>
        <Text style={{ color: trendColor }}>{arrow} </Text>
        {trendCopy(deltaVsPrev)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap:        spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.xs,
  },
  score: {
    fontFamily: font.ui,
    fontWeight: weight.bold,
    fontSize:   64,
    lineHeight: 68,
  },
  outOf: {
    ...type.body,
    fontSize: 24,
    color:    neutral.textMid,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  trend: {
    ...type.body,
    fontSize: 13,
    color:    neutral.textDim,
  },
});
