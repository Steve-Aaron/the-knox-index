import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { fmtCount } from '@/lib/format';
import { accent, knox } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { AccountKpis } from '@/data/account/types';
import { KpiStat } from './KpiStat';

/**
 * KpiStrip
 * ---------
 * The five headline numbers for the selected range + platform. A row on
 * wide screens, a single centred column on mobile.
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
    key: 'engagementRate', label: 'Engagement rate', color: knox.primaryPurple, format: n => `${n}%`,
    infoText: 'Likes, comments, saves and shares divided by views, across posts in the period.',
  },
];

export function KpiStrip({ kpis, compact = false }: Props) {
  return (
    <View style={[styles.row, compact && styles.column]}>
      <DevLabel name="KpiStrip" />
      {KPI_DEFS.map(def => (
        <KpiStat
          key={def.key}
          value={kpis[def.key]}
          format={def.format}
          label={def.label}
          color={def.color}
          infoText={def.infoText}
          sublabel={def.sublabel}
          compact={compact}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'space-between',
    rowGap:         spacing.xl,
    columnGap:      spacing.xl,
  },
  column: {
    flexDirection: 'column',
    alignItems:    'center',
  },
});
