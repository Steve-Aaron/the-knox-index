import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * SectionDivider
 * ---------------
 * Small uppercase kicker title, followed by a thin horizontal rule that
 * stretches to the right edge of its container. Used as a major-section
 * separator on the account page and dashboard sections.
 *
 * One job: signal 'a new section starts here'.
 */

interface Props {
  title: string;
}

export function SectionDivider({ title }: Props) {
  return (
    <View style={styles.wrap}>
      <DevLabel name="SectionDivider" />
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    marginBottom:  spacing.sm,
  },
  title: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.8,
  },
  line: {
    flex:            1,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
