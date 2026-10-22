import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BoxWhisker } from '@/components/primitives/BoxWhisker';
import { formatters } from '@/components/primitives/CountUp';
import { InfoTip } from '@/components/primitives/InfoTip';
import { glass, neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { PostBenchmarks } from '@/data/types';

/**
 * PostCompareSection
 * -------------------
 * 'HOW THIS POST COMPARES' — two box-and-whisker plots placing the post's
 * views and engagement rate against every post we track. Side by side, or
 * stacked on narrow screens.
 *
 * One job: show where one post sits in the dataset.
 */
interface Props {
  views:          number;
  /** Percentage. */
  engagementRate: number;
  benchmarks:     PostBenchmarks;
  colour:         string;
  stacked?:       boolean;
}

export function PostCompareSection({ views, engagementRate, benchmarks, colour, stacked = false }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.kicker}>HOW THIS POST COMPARES</Text>
        <InfoTip
          text="These charts show where this post sits against all other posts we track. The coloured box covers the middle 50% of posts. The vertical line is the median. The dot is this post. Hover each part to learn more."
          width={280}
        />
      </View>
      <View style={[styles.row, stacked && styles.rowStacked]}>
        <BoxWhisker
          label="Views vs dataset"
          value={views}
          benchmark={benchmarks.views}
          colour={colour}
          format={formatters.compact}
          scaleType="log"
        />
        <View style={[styles.divider, stacked && styles.dividerStacked]} />
        <BoxWhisker
          label="Engagement rate"
          value={engagementRate}
          benchmark={benchmarks.engagement}
          colour={colour}
          format={v => `${v.toFixed(1)}%`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  // Two plots rendered side-by-side to save vertical space
  row: {
    flexDirection: 'row',
    gap: 0,
  },
  // Mobile: stack the two plots vertically.
  rowStacked: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  divider: {
    width: 1,
    backgroundColor: glass.border,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  // Mobile: the divider becomes a full-width hairline between the stacked plots.
  dividerStacked: {
    width: '100%' as any,
    height: 1,
    marginHorizontal: 0,
    marginVertical: spacing.sm,
    alignSelf: 'auto',
  },
});
