import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useLayoutWidth } from '@/hooks/useLayoutWidth';
import { fmtCount } from '@/lib/format';
import { accent, knox, party } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { AccountKpis } from '@/data/account/types';
import { KpiStat } from './KpiStat';

/**
 * KpiStrip
 * ---------
 * The five headline numbers for the selected range + platform. Five equal
 * columns in one row; the figures scale with the column width (56px down to
 * 28px), so they only ever shrink as the row narrows and never wrap. A
 * single centred column on mobile.
 *
 * One job: lay out the KPI set.
 */
interface Props {
  kpis:     AccountKpis;
  compact?: boolean;
}

interface KpiDef {
  key:       keyof AccountKpis;
  label:     string;
  color:     string;
  format:    (n: number) => string;
  decimals?: number;
  infoText:  string;
  sublabel?: string;
}

const KPI_DEFS: KpiDef[] = [
  {
    key: 'posts', label: 'Posts', color: accent.indigo, format: n => n.toLocaleString(),
    sublabel: 'posts tracked',
    infoText: 'Posts published in the selected period on the selected platforms.',
  },
  {
    key: 'followers', label: 'Followers', color: knox.primaryOrange, format: fmtCount,
    infoText: 'Current follower count across the selected platforms.',
  },
  {
    key: 'avgViewsPerPost', label: 'Avg views / post', color: knox.secondaryOrange, format: fmtCount,
    infoText: 'Total views in the period divided by the number of posts.',
  },
  {
    key: 'totalLikes', label: 'Total likes', color: knox.primaryPink, format: fmtCount,
    infoText: 'Likes received on posts published in the selected period.',
  },
  {
    key: 'engagementRate', label: 'Engagement rate', color: party.labour.base, format: n => `${n.toFixed(1)}%`, decimals: 1,
    infoText: 'Likes, comments, saves and shares divided by views, across posts in the period.',
  },
];

const GAP = spacing.xl;
const MAX_FIGURE = 56;
const MIN_FIGURE = 28;
/** A six-character figure like '496.6K' is about 3.5× its font size wide. */
const FIGURE_WIDTH_RATIO = 3.6;

export function KpiStrip({ kpis, compact = false }: Props) {
  const [width, onLayout] = useLayoutWidth();
  const columns = KPI_DEFS.length;
  // Whole pixels, 1px short: the measured width is rounded and may be up to
  // half a pixel wider than the row, and fractional cells that overshoot it
  // wrap the last stat at every other width.
  const cellWidth = Math.floor((width - 1 - GAP * (columns - 1)) / columns);
  // Until measured, share the row equally.
  const cell = width > 0 ? { width: cellWidth } : styles.cellUnmeasured;
  const figureSize = width > 0
    ? Math.max(MIN_FIGURE, Math.min(MAX_FIGURE, Math.floor(cellWidth / FIGURE_WIDTH_RATIO)))
    : MAX_FIGURE;

  return (
    <View style={[styles.row, compact && styles.column]} onLayout={onLayout}>
      <DevLabel name="KpiStrip" />
      {KPI_DEFS.map(def => (
        <KpiStat
          key={def.key}
          value={kpis[def.key]}
          format={def.format}
          decimals={def.decimals}
          label={def.label}
          color={def.color}
          infoText={def.infoText}
          sublabel={def.sublabel}
          compact={compact}
          figureSize={figureSize}
          style={compact ? undefined : cell}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    rowGap:        GAP,
    columnGap:     GAP,
  },
  cellUnmeasured: {
    flex: 1,
  },
  column: {
    flexDirection: 'column',
    alignItems:    'center',
  },
});
