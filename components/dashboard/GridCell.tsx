import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Breakpoint, GRID_COLS, GRID_GAP, useBreakpoint } from '@/theme/breakpoints';

/**
 * GridCell
 * ---------
 * Declares how many of 12 columns it occupies at each breakpoint.
 * Defaults cascade: mobile → tablet → desktop → wide.
 * One job: width sizing based on breakpoint.
 */
interface Props {
  children: React.ReactNode;
  mobile?: number;   // 1..12, default 12
  tablet?: number;   // falls back to mobile
  desktop?: number;  // falls back to tablet
  wide?: number;     // falls back to desktop
  style?: ViewStyle;
}

export function GridCell({
  children,
  mobile = 12,
  tablet,
  desktop,
  wide,
  style,
}: Props) {
  const bp = useBreakpoint();

  const cols = resolveCols(bp, { mobile, tablet, desktop, wide });
  const widthPct = `${(cols / GRID_COLS) * 100}%` as const;

  return (
    <View
      style={[
        styles.cell,
        // @ts-ignore — RN accepts % string
        { width: widthPct },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function resolveCols(
  bp: Breakpoint,
  spans: { mobile: number; tablet?: number; desktop?: number; wide?: number }
) {
  const { mobile, tablet, desktop, wide } = spans;
  if (bp === 'wide') return wide ?? desktop ?? tablet ?? mobile;
  if (bp === 'desktop') return desktop ?? tablet ?? mobile;
  if (bp === 'tablet') return tablet ?? mobile;
  return mobile;
}

const styles = StyleSheet.create({
  cell: {
    paddingHorizontal: GRID_GAP / 2,
    paddingVertical: GRID_GAP / 2,
  },
});
