import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatters } from '@/components/primitives/CountUp';
import { glass, neutral } from '@/theme/colors';
import { font, type } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * PostStatsRow
 * -------------
 * Views · Likes · Comments · Shares with hairline dividers, values tinted
 * with the account colour.
 *
 * One job: the four headline counts of a post card.
 */
interface Props {
  views:       number;
  likes:       number;
  comments:    number;
  shares:      number;
  accentColor: string;
  /** Wider fixed spacing (split / narrow cards); the row still hugs the left edge. */
  spread?:     boolean;
}

export function PostStatsRow({ views, likes, comments, shares, accentColor, spread = false }: Props) {
  const divider = <View style={styles.divider} />;
  return (
    <View style={[styles.row, spread && styles.rowSpread]}>
      <PostStat label="Views"    value={views}    accentColor={accentColor} />
      {divider}
      <PostStat label="Likes"    value={likes}    accentColor={accentColor} />
      {divider}
      <PostStat label="Comments" value={comments} accentColor={accentColor} />
      {divider}
      <PostStat label="Shares"   value={shares}   accentColor={accentColor} />
    </View>
  );
}

function PostStat({ label, value, accentColor }: { label: string; value: number; accentColor: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, { color: accentColor }]}>
        {formatters.compact(value)}
      </Text>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  rowSpread: {
    gap: spacing.xxl,
  },
  stat: {
    gap: 2,
  },
  value: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  label: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: glass.border,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
});
