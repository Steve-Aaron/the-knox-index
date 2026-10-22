import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TimeRangePicker } from '@/components/dashboard/TimeRangePicker';
import { ChipGroup, type ChipOption } from '@/components/primitives/ChipGroup';
import { DevLabel } from '@/components/primitives/DevLabel';
import { spacing } from '@/theme/spacing';
import type { AccountKpis, AccountPlatform, TimeRange } from '@/data/account/types';
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
  kpis:             AccountKpis;
  compact?:         boolean;
}

const PLATFORM_OPTIONS: ChipOption<AccountPlatform>[] = [
  { value: 'all',    label: 'All' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x',      label: 'X' },
];

export function OverviewPanel({
  range,
  onRangeChange,
  platform,
  onPlatformChange,
  kpis,
  compact = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <DevLabel name="OverviewPanel" />
      {/* Mock phase: every range is open. Wire isRegistered + onLockedTap
          (as on the dashboard) once real data is behind registration. */}
      <TimeRangePicker value={range} onChange={onRangeChange} isRegistered />
      <ChipGroup
        label="Platform"
        options={PLATFORM_OPTIONS}
        value={platform}
        onChange={onPlatformChange}
      />
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
