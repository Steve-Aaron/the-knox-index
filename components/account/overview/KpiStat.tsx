import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CountUp } from '@/components/primitives/CountUp';
import { InfoTip } from '@/components/primitives/InfoTip';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type, weight } from '@/theme/typography';

/**
 * KpiStat
 * --------
 * One headline number: big coloured value, caption label with helper, and an
 * optional sub-line. Counts up on change. Centred when compact (mobile column).
 *
 * One job: present a single KPI.
 */
interface Props {
  value:    number;
  format:   (n: number) => string;
  /** Decimal places kept while counting. Default 0. */
  decimals?: number;
  label:    string;
  color:    string;
  infoText: string;
  sublabel?: string;
  compact?:  boolean;
  /** Smaller figure for a narrow grid cell. */
  small?:    boolean;
  /** Cell size from the parent grid. */
  style?:    ViewStyle;
}

export function KpiStat({ value, format, decimals, label, color, infoText, sublabel, compact = false, small = false, style }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <CountUp
        value={value}
        decimals={decimals}
        format={format}
        style={[styles.value, (compact || small) && styles.valueCompact, { color }]}
      />
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <InfoTip text={infoText} />
      </View>
      {sublabel ? <Text style={[styles.sublabel, compact && styles.textCentre]}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The parent grid gives every stat the same fixed width, so a number that
  // grows or shrinks while it counts never pushes its neighbours sideways.
  wrap: {
    gap: spacing.xs,
  },
  wrapCompact: {
    alignItems: 'center',
  },
  textCentre: {
    textAlign: 'center',
  },
  value: {
    fontFamily:    font.mono,
    fontWeight:    weight.bold,
    fontSize:      56,
    lineHeight:    64,
    letterSpacing: -1,
  },
  valueCompact: {
    fontSize:   48,
    lineHeight: 56,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  label: {
    ...type.caption,
    fontSize: 12,
    color:    neutral.textMid,
  },
  sublabel: {
    ...type.body,
    fontSize: 12,
    color:    neutral.textDim,
  },
});
