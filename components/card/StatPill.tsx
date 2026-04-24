import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { neutral, glass } from '@/theme/colors';
import { type } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';
import { CountUp } from '@/components/primitives/CountUp';

/**
 * StatPill
 * ---------
 * Small rounded pill showing a label and a value. One job.
 */
interface Props {
  label: string;
  value: number;
  highlight?: boolean;
  accentColour?: string;
}

export function StatPill({ label, value, highlight, accentColour }: Props) {
  return (
    <View
      style={[
        styles.pill,
        highlight && accentColour
          ? { borderColor: accentColour, shadowColor: accentColour, shadowOpacity: 0.5, shadowRadius: 8 }
          : null,
      ]}
    >
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <CountUp
        value={value}
        style={[styles.value, highlight && accentColour ? { color: accentColour } : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flex: 1,
  },
  label: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 9,
    marginBottom: 2,
  },
  value: {
    ...type.numberMd,
    color: neutral.text,
  },
});
