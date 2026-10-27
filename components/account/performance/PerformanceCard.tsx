import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { RadarChart, type RadarAxis, type RadarSeries } from '@/components/charts/radar/RadarChart';
import { FollowerQualityFlag } from '@/components/dashboard/FollowerQualityFlag';
import { InfoTip } from '@/components/primitives/InfoTip';
import { Kicker } from '@/components/ui/Kicker';
import { useLayoutWidth } from '@/hooks/useLayoutWidth';
import { spacing } from '@/theme/spacing';
import type { Politician } from '@/data/types';
import type { AccountPeriodData, RadarAxisKey } from '@/data/account/types';
import { PLATFORM_META, PLATFORM_ORDER } from '../platforms';
import { RadarLegend, type LegendItem } from './RadarLegend';

/**
 * PerformanceCard
 * ----------------
 * Radar comparing the account's platforms on the five score axes, plus the
 * follower-quality verdict underneath.
 *
 * One job: show how the account performs, per platform.
 */
interface Props {
  radar:      AccountPeriodData['radar'];
  /** Feeds the shared FollowerQualityFlag. */
  politician: Politician;
  height?:    number;
  /** Layout from the parent, e.g. flex share in a row. */
  style?:     ViewStyle;
}

const AXES: RadarAxis<RadarAxisKey>[] = [
  { key: 'virality',   label: 'Virality',    desc: 'Avg views per follower' },
  { key: 'activity',   label: 'Activity',    desc: 'Posting frequency in the period' },
  { key: 'engagement', label: 'Eng. %',      desc: 'Active engagements divided by views' },
  { key: 'followers',  label: 'Followers',   desc: 'Total followers' },
  { key: 'knoxFactor', label: 'Knox factor', desc: 'Our custom rating of this account\'s effectiveness' },
];

/** Largest the radar gets, so it never dominates a wide card. */
const MAX_CHART_SIZE = 400;

export function PerformanceCard({ radar, politician, height, style }: Props) {
  const [chartWidth, onChartLayout] = useLayoutWidth();
  const chartSize = Math.min(chartWidth, MAX_CHART_SIZE);

  const { series, legend } = useMemo(() => {
    const shown = PLATFORM_ORDER.flatMap(p => {
      const values = radar[p];
      return values ? [{ platform: p, values, ...PLATFORM_META[p] }] : [];
    });
    return {
      series: shown.map<RadarSeries<RadarAxisKey>>(s => ({ id: s.platform, label: s.label, color: s.color, values: s.values })),
      legend: shown.map<LegendItem>(s => ({ id: s.platform, label: s.label, color: s.color })),
    };
  }, [radar]);

  return (
    <AccountWidget
      height={height}
      style={style}
      infoText="Each axis is scored 0–100 relative to every tracked account. Compare platforms to see where this account is strongest."
    >
      <WidgetHeader title="Performance" />

      <View style={styles.subheader}>
        <View style={styles.kickerRow}>
          <Kicker tone="dim">Performance radar</Kicker>
          <InfoTip text="Virality is views per follower, Activity is posting frequency, Eng. % is interactions per view, Followers is audience size, Knox Factor is the composite." />
        </View>
        <RadarLegend items={legend} />
      </View>

      <View style={styles.chartArea} onLayout={onChartLayout}>
        {chartSize > 0 ? <RadarChart axes={AXES} series={series} size={chartSize} /> : null}
      </View>

      <FollowerQualityFlag politician={politician} />
    </AccountWidget>
  );
}

const styles = StyleSheet.create({
  subheader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            spacing.sm,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  chartArea: {
    flexGrow:       1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      280,
  },
});
