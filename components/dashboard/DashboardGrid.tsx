import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { GRID_GAP, GRID_MAX_WIDTH } from '@/theme/breakpoints';
import { spacing } from '@/theme/spacing';

/**
 * DashboardGrid
 * --------------
 * A 12-column responsive container. Children are expected to be GridCell
 * instances declaring how many columns they occupy per breakpoint.
 * One job: lay out the grid and give children a consistent gutter + max width.
 */
interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DashboardGrid({ children, style }: Props) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  inner: {
    width: '100%',
    maxWidth: GRID_MAX_WIDTH,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Use negative margin trick to space children uniformly on both axes.
    marginHorizontal: -GRID_GAP / 2,
    marginVertical: -GRID_GAP / 2,
  },
});
