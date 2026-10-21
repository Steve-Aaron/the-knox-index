import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatters } from '@/components/primitives/CountUp';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';

/**
 * PostMetricsRow
 * ---------------
 * Large, scannable Views / Likes / Comments / Shares across the detail column.
 *
 * One job: the four headline counts of the post detail.
 */
interface Props {
  views:    number;
  likes:    number;
  comments: number;
  shares:   number;
  colour:   string;
}

export function PostMetricsRow({ views, likes, comments, shares, colour }: Props) {
  return (
    <View style={styles.row}>
      <MetricPill value={views}    label="Views"    colour={colour} />
      <MetricPill value={likes}    label="Likes"    colour={colour} />
      <MetricPill value={comments} label="Comments" colour={colour} />
      <MetricPill value={shares}   label="Shares"   colour={colour} />
    </View>
  );
}

function MetricPill({ value, label, colour }: { value: number; label: string; colour: string }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.value, { color: colour }]}>
        {formatters.compact(value)}
      </Text>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  pill: { gap: 2, flex: 1 },
  value: {
    fontFamily: font.mono,
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
});
