import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { glass, neutral } from '@/theme/colors';
import { font, type } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * PostEngagementRow
 * ------------------
 * 'ENGAGEMENT RATE ···· 7.34%' strip along the foot of a post card.
 *
 * One job: show one post's engagement rate.
 */
interface Props {
  /** Percentage; ignored when the post has no views. */
  rate:        number;
  hasViews:    boolean;
  accentColor: string;
}

export function PostEngagementRow({ rate, hasViews, accentColor }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>ENGAGEMENT RATE</Text>
      <Text style={[styles.value, { color: accentColor }]}>
        {hasViews ? `${rate}%` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: glass.border,
  },
  label: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  value: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
