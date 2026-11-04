import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmtCount } from '@/lib/format';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type, weight } from '@/theme/typography';
import type { ContentBreakdown } from '@/data/account/types';
import { useAccountLayout } from '../layout/accountLayout';

/**
 * ContentSummary
 * ---------------
 * Three inline figures above the donut: posts, avg views / post, top slice.
 * One row at every width — the figures shrink on mobile instead of wrapping.
 *
 * One job: summarise the active content breakdown.
 */
interface Props {
  breakdown: ContentBreakdown;
}

export function ContentSummary({ breakdown }: Props) {
  const top = breakdown.slices[0];
  const { isMobile } = useAccountLayout();

  return (
    <View style={styles.row}>
      <Figure label="Posts" value={fmtCount(breakdown.totalPosts)} compact={isMobile} />
      <Figure label="Avg views / post" value={fmtCount(breakdown.avgViewsPerPost)} compact={isMobile} />
      {top ? (
        <Figure label="Top" value={`${top.label} · ${(top.share * 100).toFixed(1)}%`} compact={isMobile} shrink />
      ) : null}
    </View>
  );
}

interface FigureProps {
  label:    string;
  value:    string;
  compact?: boolean;
  /** Give way first when the row is tight — the long 'Top' value. */
  shrink?:  boolean;
}

function Figure({ label, value, compact = false, shrink = false }: FigureProps) {
  return (
    <View style={[styles.figure, shrink && styles.figureShrink]}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    gap:            spacing.base,
  },
  figure: {
    gap:        spacing.xs,
    flexShrink: 0,
  },
  figureShrink: {
    flexShrink: 1,
    minWidth:   0,
  },
  label: {
    ...type.caption,
    fontSize: 10,
    color:    neutral.textMid,
  },
  value: {
    fontFamily:    font.mono,
    fontWeight:    weight.bold,
    fontSize:      18,
    letterSpacing: -0.3,
    color:         neutral.text,
  },
  valueCompact: {
    fontSize: 15,
  },
});
