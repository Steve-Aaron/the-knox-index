import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useLayoutWidth } from '@/hooks/useLayoutWidth';
import { fmtCount } from '@/lib/format';
import { accent, knox, party } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { AccountKpis, FollowerGrowth } from '@/data/account/types';
import { KpiStat } from './KpiStat';

/**
 * KpiStrip
 * ---------
 * The headline numbers for the selected range + platform, including
 * followers gained over the period. One row of equal columns: the figures
 * shrink to fit the cell before anything wraps, and only below
 * MIN_COLUMN do the rest wrap onto a second row. A single centred column on
 * mobile.
 *
 * One job: lay out the KPI set.
 */
interface Props {
  kpis:            AccountKpis;
  followerGrowth?: FollowerGrowth | null;
  compact?:        boolean;
}

type KpiKey = keyof AccountKpis | 'newFollowers';

interface KpiDef {
  key:       KpiKey;
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
    key: 'newFollowers', label: 'New followers', color: '#3DDC97', format: n => `${n >= 0 ? '+' : ''}${fmtCount(n)}`,
    infoText: 'Followers gained over the period on the selected platforms: the latest follower count against the one at the start of the period. TikTok counts are daily; X counts are daily from 1 November 2026.',
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

/** Figure size bounds; it scales with the cell in between. */
const MAX_FIGURE = 56;
const MIN_FIGURE = 30;
/** A cell at least this wide keeps every KPI on one row. */
const MIN_COLUMN = 128;
const GAP = spacing.lg;

function fmtSince(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function KpiStrip({ kpis, followerGrowth = null, compact = false }: Props) {
  const [width, onLayout] = useLayoutWidth();
  const n = KPI_DEFS.length;
  const columns = Math.max(1, Math.min(n, Math.floor((width + GAP) / (MIN_COLUMN + GAP))));
  const cellWidth = (width - GAP * (columns - 1)) / columns;
  // A 6-character figure like '496.6K' is about 3.7em wide in the mono face
  const figure = Math.round(Math.max(MIN_FIGURE, Math.min(MAX_FIGURE, cellWidth / 3.8)));
  // Until measured, share the row equally.
  const cell = width > 0 ? { width: cellWidth } : styles.cellUnmeasured;

  const valueOf = (key: KpiKey): number | null =>
    key === 'newFollowers' ? followerGrowth?.gained ?? null : kpis[key];

  const sublabelOf = (def: KpiDef): string | undefined => {
    if (def.key !== 'newFollowers') return def.sublabel;
    if (!followerGrowth) return 'no count at the start of the period';
    const pct = followerGrowth.pct * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% since ${fmtSince(followerGrowth.since)}`;
  };

  return (
    <View style={[styles.row, compact && styles.column]} onLayout={onLayout}>
      <DevLabel name="KpiStrip" />
      {KPI_DEFS.map(def => (
        <KpiStat
          key={def.key}
          value={valueOf(def.key)}
          format={def.format}
          decimals={def.decimals}
          label={def.label}
          color={def.color}
          infoText={def.infoText}
          sublabel={sublabelOf(def)}
          compact={compact}
          figureSize={compact ? undefined : figure}
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
