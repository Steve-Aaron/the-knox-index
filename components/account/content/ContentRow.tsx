import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtCount } from '@/lib/format';
import { neutral, trend } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';
import type { ContentSlice } from '@/data/account/types';
import { useContentColumns } from './contentColumns';

/**
 * ContentRow
 * -----------
 * One slice in the content table: dot, post count, label, views, share,
 * delta, with a share bar underneath. Hover previews and press pins the
 * slice; dims while another slice is highlighted.
 *
 * One job: render a single content slice.
 */
interface Props {
  slice:     ContentSlice;
  color:     string;
  /** Share of the largest slice — sizes the bar relative to the leader. */
  barRatio:  number;
  showDelta: boolean;
  /** Another slice is highlighted — fade this one back. */
  dimmed:    boolean;
  /** This slice is pinned. */
  pinned:    boolean;
  onHover:   (key: string | null) => void;
  onPress:   (key: string) => void;
}

function fmtDelta(pp: number): string {
  return `${pp > 0 ? '+' : ''}${pp.toFixed(1)}pp`;
}

export function ContentRow({ slice, color, barRatio, showDelta, dimmed, pinned, onHover, onPress }: Props) {
  const contentColumns = useContentColumns();
  const deltaColor = slice.deltaPp > 0 ? trend.up : slice.deltaPp < 0 ? trend.downPp : neutral.textMid;

  return (
    <Pressable
      onPress={() => onPress(slice.key)}
      onHoverIn={() => onHover(slice.key)}
      onHoverOut={() => onHover(null)}
      accessibilityRole="button"
      accessibilityState={{ selected: pinned }}
      accessibilityLabel={`${slice.label}, ${(slice.share * 100).toFixed(1)}% of views`}
      style={[styles.wrap, dimmed && styles.dimmed]}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.posts, { color }]}>{slice.posts}</Text>
        <Text style={styles.label} numberOfLines={1}>{slice.label}</Text>
        <Text style={[styles.num, contentColumns.views]}>{fmtCount(slice.views)}</Text>
        <Text style={[styles.num, styles.dim, contentColumns.share]}>
          {(slice.share * 100).toFixed(1)}%
        </Text>
        {showDelta ? (
          <Text style={[styles.num, contentColumns.delta, { color: deltaColor }]}>
            {fmtDelta(slice.deltaPp)}
          </Text>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${barRatio * 100}%`, backgroundColor: color }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'opacity', transitionDuration: '160ms' } as any,
      default: {},
    }),
  },
  dimmed: {
    opacity: 0.35,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  posts: {
    fontFamily: font.mono,
    fontSize:   14,
    minWidth:   32,
  },
  label: {
    ...type.body,
    fontSize: 14,
    color:    neutral.text,
    flex:     1,
  },
  num: {
    fontFamily: font.mono,
    fontSize:   13,
    color:      neutral.text,
    textAlign:  'right',
  },
  dim: {
    color: neutral.textMid,
  },
  track: {
    height:          3,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow:        'hidden',
  },
  fill: {
    height:       '100%',
    borderRadius: 2,
  },
});
