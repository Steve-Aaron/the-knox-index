import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { useLayoutWidth } from '@/hooks/useLayoutWidth';
import { fmtCount } from '@/lib/format';
import { accent, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { ContentBreakdown } from '@/data/account/types';
import { sliceColor } from './contentPalette';

/**
 * ContentDonut
 * -------------
 * Views share per slice as a ring, with total views and its change in the
 * centre. While a slice is highlighted the centre shows that slice instead:
 * its label, views and share.
 *
 * One job: visualise the active content breakdown.
 */
interface Props {
  breakdown:      ContentBreakdown;
  /** 'vs prev week' etc. Null hides the delta. */
  prevLabel:      string | null;
  activeKey:      string | null;
  onSliceHover:   (key: string | null) => void;
  onSlicePress:   (key: string) => void;
}

const MAX_SIZE = 240;

export function ContentDonut({ breakdown, prevLabel, activeKey, onSliceHover, onSlicePress }: Props) {
  const [width, onLayout] = useLayoutWidth();
  const size = Math.min(width, MAX_SIZE);

  const segments = useMemo<DonutSegment[]>(
    () => breakdown.slices.map((s, i) => ({ key: s.key, value: s.views, color: sliceColor(i) })),
    [breakdown.slices],
  );

  const active = activeKey != null ? breakdown.slices.find(s => s.key === activeKey) : undefined;
  const delta = breakdown.totalViewsDeltaPct;
  const deltaColor = delta >= 0 ? accent.mint : accent.amber;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {size > 0 ? (
        <DonutChart
          segments={segments}
          size={size}
          thickness={Math.round(size * 0.13)}
          activeKey={activeKey}
          onSegmentHover={onSliceHover}
          onSegmentPress={onSlicePress}
        >
          {active ? (
            <>
              <Text style={[styles.kicker, styles.centreLabel]} numberOfLines={1}>{active.label}</Text>
              <Text style={styles.total}>{fmtCount(active.views)}</Text>
              <Text style={[styles.delta, styles.share]}>{(active.share * 100).toFixed(1)}% of views</Text>
            </>
          ) : (
            <>
              <Text style={styles.kicker}>Total views</Text>
              <Text style={styles.total}>{fmtCount(breakdown.totalViews)}</Text>
              {prevLabel ? (
                <Text style={[styles.delta, { color: deltaColor }]}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% {prevLabel}
                </Text>
              ) : null}
            </>
          )}
        </DonutChart>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap:        spacing.xs,
  },
  kicker: {
    ...type.caption,
    fontSize: 10,
    color:    neutral.textMid,
  },
  centreLabel: {
    maxWidth:  '60%',
    textAlign: 'center',
  },
  total: {
    fontFamily: font.mono,
    fontSize:   28,
    color:      neutral.text,
  },
  delta: {
    ...type.body,
    fontSize: 11,
  },
  share: {
    color: neutral.textMid,
  },
});
