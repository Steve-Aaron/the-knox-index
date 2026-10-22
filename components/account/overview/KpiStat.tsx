import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  label:    string;
  color:    string;
  infoText: string;
  sublabel?: string;
  compact?:  boolean;
}

export function KpiStat({ value, format, label, color, infoText, sublabel, compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <CountUp
        value={value}
        format={format}
        style={[styles.value, compact && styles.valueCompact, { color }]}
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
