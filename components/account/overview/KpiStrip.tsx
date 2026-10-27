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
 * The five headline numbers for the selected range + platform. A grid of
 * equal columns: as many as fit (up to five), the rest wrap onto the next
 * row in the same columns. Figures step down a size in narrow cells before
 * anything wraps. A single centred column on mobile.
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

/** Narrowest cell for a full-size (56px) figure like '496.6K'. */
const FULL_COLUMN = 210;
/** Narrowest cell at all: the figure drops to 48px. */
const MIN_COLUMN = 172;
const GAP = spacing.xl;

export function KpiStrip({ kpis, compact = false }: Props) {
  const [width, onLayout] = useLayoutWidth();
  const columns = Math.max(1, Math.min(KPI_DEFS.length, Math.floor((width + GAP) / (MIN_COLUMN + GAP))));
  const cellWidth = (width - GAP * (columns - 1)) / columns;
  // Until measured, share the row equally.
  const cell = width > 0 ? { width: cellWidth } : styles.cellUnmeasured;

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
          small={width > 0 && cellWidth < FULL_COLUMN}
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
