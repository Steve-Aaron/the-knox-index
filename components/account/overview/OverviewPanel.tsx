import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TimeRangePicker } from '@/components/dashboard/TimeRangePicker';
import { PlatformLogoFilter } from '@/components/primitives/PlatformLogoFilter';
import { DevLabel } from '@/components/primitives/DevLabel';
import { spacing } from '@/theme/spacing';
import type { AccountKpis, AccountPlatform, SocialPlatform, TimeRange } from '@/data/account/types';
import { KpiStrip } from './KpiStrip';

/**
 * OverviewPanel
 * --------------
 * Top of the main column: time range picker, platform filter, KPI strip.
 * Controlled — the screen owns range + platform because every widget below
 * reads them.
 *
 * One job: compose the page-level filters with their headline numbers.
 */
interface Props {
  range:            TimeRange;
  onRangeChange:    (next: TimeRange) => void;
  platform:         AccountPlatform;
  onPlatformChange: (next: AccountPlatform) => void;
  /** Platforms with data. The filter is hidden until there are two. */
  platforms:        SocialPlatform[];
  kpis:             AccountKpis;
  compact?:         boolean;
}

export function OverviewPanel({
  range,
  onRangeChange,
  platform,
  onPlatformChange,
  platforms,
  kpis,
  compact = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <DevLabel name="OverviewPanel" />
      {/* Mock phase: every range is open. Wire isRegistered + onLockedTap
          (as on the dashboard) once real data is behind registration. */}
      <TimeRangePicker value={range} onChange={onRangeChange} isRegistered />
      {platforms.length > 1 ? (
        <PlatformLogoFilter
          platforms={(['tiktok', 'x'] as const).filter(p => platforms.includes(p))}
          value={platform}
          onChange={onPlatformChange}
        />
      ) : null}
      <View style={styles.kpis}>
        <KpiStrip kpis={kpis} compact={compact} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  kpis: {
    paddingVertical:   spacing.xl,
    paddingHorizontal: spacing.sm,
  },
});
