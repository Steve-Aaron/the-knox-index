import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { useLayoutWidth } from '@/hooks/useLayoutWidth';
import { fmtCount } from '@/lib/format';
import { neutral, trend } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { ContentBreakdown } from '@/data/account/types';
import { OTHER_KEY, type SliceGroups } from './contentGroups';
import { OTHER_COLOR, sliceColor } from './contentPalette';

/**
 * ContentDonut
 * -------------
 * Views share per slice as a ring, with total views and its change in the
 * centre. Small slices share one grey "Other" segment (see contentGroups).
 * While a slice is highlighted the centre shows that slice instead: its
 * label, views and share.
 *
 * One job: visualise the active content breakdown.
 */
interface Props {
  breakdown:      ContentBreakdown;
  groups:         SliceGroups;
  /** Plural for the "Other (12 subjects)" label. */
  sliceNoun:      string;
  /** 'vs prev week' etc. Null hides the delta. */
  prevLabel:      string | null;
  activeKey:      string | null;
  onSliceHover:   (key: string | null) => void;
  onSlicePress:   (key: string) => void;
}

const MAX_SIZE = 260;
/** Ring thickness as a share of the diameter: 30px on the 260px Figma donut. */
const THICKNESS = 30 / 260;

export function ContentDonut({ breakdown, groups, sliceNoun, prevLabel, activeKey, onSliceHover, onSlicePress }: Props) {
  const [width, onLayout] = useLayoutWidth();
  const size = Math.min(width, MAX_SIZE);

  const segments = useMemo<DonutSegment[]>(() => {
    const named = groups.named.map((s, i) => ({ key: s.key, value: s.views, color: sliceColor(i) }));
    return groups.other
      ? [...named, { key: OTHER_KEY, value: groups.other.views, color: OTHER_COLOR }]
      : named;
  }, [groups]);

  // A slice folded into "Other" highlights the whole "Other" segment.
  const segmentKey = activeKey != null && groups.otherKeys.has(activeKey) ? OTHER_KEY : activeKey;
  const active = segmentKey === OTHER_KEY && groups.other
    ? { label: `Other (${groups.other.count} ${sliceNoun})`, views: groups.other.views, share: groups.other.share }
    : segmentKey != null ? groups.named.find(s => s.key === segmentKey) : undefined;
  const delta = breakdown.totalViewsDeltaPct;
  const deltaColor = delta >= 0 ? trend.up : trend.downPp;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {size > 0 ? (
        <DonutChart
          segments={segments}
          size={size}
          thickness={Math.round(size * THICKNESS)}
          activeKey={segmentKey}
          centreGlow={segments[0]?.color}
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
