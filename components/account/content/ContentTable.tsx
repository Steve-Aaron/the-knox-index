import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { ContentSlice } from '@/data/account/types';
import { useContentColumns } from './contentColumns';
import { OTHER_KEY, type SliceGroups } from './contentGroups';
import { OTHER_COLOR, sliceColor } from './contentPalette';
import { ContentRow } from './ContentRow';
import type { SliceHighlight } from './useSliceHighlight';

/**
 * ContentTable
 * -------------
 * Column header + every slice, including the ones the donut folds into
 * "Other" (drawn grey). Never scrolls itself: the card scrolls its whole
 * body instead. Rows share the donut's highlight.
 *
 * One job: tabulate the content slices.
 */
interface Props {
  slices:      ContentSlice[];
  groups:      SliceGroups;
  /** First column heading, e.g. 'Topic'. */
  columnLabel: string;
  /** 'vs prev week' etc. Null hides the delta column. */
  prevLabel:   string | null;
  highlight:   SliceHighlight;
}

export function ContentTable({ slices, groups, columnLabel, prevLabel, highlight }: Props) {
  const contentColumns = useContentColumns();
  const maxShare = slices[0]?.share ?? 0;
  const showDelta = prevLabel != null;

  const active = highlight.activeKey;
  // The "Other" segment lights up every row folded into it.
  const lit = (key: string) => active === key || (active === OTHER_KEY && groups.otherKeys.has(key));

  const rows = slices.map((slice, i) => (
    <ContentRow
      key={slice.key}
      slice={slice}
      color={groups.otherKeys.has(slice.key) ? OTHER_COLOR : sliceColor(i)}
      barRatio={maxShare > 0 ? slice.share / maxShare : 0}
      showDelta={showDelta}
      dimmed={active != null && !lit(slice.key)}
      pinned={highlight.pinnedKey === slice.key}
      onHover={highlight.hover}
      onPress={highlight.toggle}
    />
  ));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.heading, styles.headingFirst]}>{columnLabel}</Text>
        <Text style={[styles.heading, styles.right, contentColumns.views]}>Views</Text>
        <Text style={[styles.heading, styles.right, contentColumns.share]}>Share</Text>
        {showDelta ? (
          <Text style={[styles.heading, styles.right, contentColumns.delta]}>{prevLabel}</Text>
        ) : null}
      </View>

      <View style={styles.list}>{rows}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           spacing.sm,
  },
  heading: {
    ...type.caption,
    fontSize: 10,
    color:    neutral.textMid,
  },
  headingFirst: {
    flex:        1,
    paddingLeft: spacing.base,
  },
  right: {
    textAlign: 'right',
  },
  list: {
    gap:           spacing.base,
    paddingBottom: spacing.sm,
  },
});
