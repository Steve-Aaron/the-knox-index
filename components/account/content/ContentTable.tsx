import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { ContentSlice } from '@/data/account/types';
import { useContentColumns } from './contentColumns';
import { sliceColor } from './contentPalette';
import { ContentRow } from './ContentRow';
import type { SliceHighlight } from './useSliceHighlight';

/**
 * ContentTable
 * -------------
 * Column header + scrollable list of slices. Scrolls internally so the card
 * keeps its fixed height on desktop. Rows share the donut's highlight.
 *
 * One job: tabulate the content slices.
 */
interface Props {
  slices:      ContentSlice[];
  /** First column heading, e.g. 'Topic'. */
  columnLabel: string;
  /** 'vs prev. week' etc. Null hides the delta column. */
  prevLabel:   string | null;
  /** Scroll inside a fixed-height card instead of growing. */
  scrollable:  boolean;
  highlight:   SliceHighlight;
}

export function ContentTable({ slices, columnLabel, prevLabel, scrollable, highlight }: Props) {
  const contentColumns = useContentColumns();
  const maxShare = slices[0]?.share ?? 0;
  const showDelta = prevLabel != null;

  const rows = slices.map((slice, i) => (
    <ContentRow
      key={slice.key}
      slice={slice}
      color={sliceColor(i)}
      barRatio={maxShare > 0 ? slice.share / maxShare : 0}
      showDelta={showDelta}
      dimmed={highlight.activeKey != null && highlight.activeKey !== slice.key}
      pinned={highlight.pinnedKey === slice.key}
      onHover={highlight.hover}
      onPress={highlight.toggle}
    />
  ));

  return (
    <View style={[styles.wrap, scrollable && styles.wrapFill]}>
      <View style={styles.header}>
        <Text style={[styles.heading, styles.headingFirst]}>{columnLabel}</Text>
        <Text style={[styles.heading, styles.right, contentColumns.views]}>Views</Text>
        <Text style={[styles.heading, styles.right, contentColumns.share]}>Share</Text>
        {showDelta ? (
          <Text style={[styles.heading, styles.right, contentColumns.delta]}>{prevLabel}</Text>
        ) : null}
      </View>

      {scrollable ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rows}
        </ScrollView>
      ) : (
        <View style={styles.list}>{rows}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  wrapFill: {
    flex:      1,
    minHeight: 0,
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
  scroll: {
    flex: 1,
  },
  list: {
    gap:           spacing.base,
    paddingBottom: spacing.sm,
  },
});
