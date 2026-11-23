import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { useAccountLayout } from '@/components/account/layout/accountLayout';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { SegmentedControl, type Segment } from '@/components/primitives/SegmentedControl';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { prevPeriodLabel } from '@/data/account/periodLabels';
import type { AccountPeriodData, ContentDimension, TimeRange } from '@/data/account/types';
import { ContentDonut } from './ContentDonut';
import { groupSlices } from './contentGroups';
import { ContentSummary } from './ContentSummary';
import { ContentTable } from './ContentTable';
import { useSliceHighlight } from './useSliceHighlight';

/**
 * ContentCard
 * ------------
 * What the account posts about, sliced by type, subject or style: summary
 * figures, a share-of-tags donut, and the per-slice table. With too few
 * tagged posts the donut is left out and the table reads as a plain list. Donut and table
 * share one highlighted slice: hover previews it, press pins it. With a
 * fixed height (desktop) everything under the header scrolls as one, so the
 * card matches Performance; otherwise it grows. On mobile the ranked list
 * comes before the donut.
 *
 * One job: compose the content breakdown for the chosen dimension.
 */
interface Props {
  content: AccountPeriodData['content'];
  range:   TimeRange;
  /** Fixed height (desktop): the body scrolls. Omit to grow with the list. */
  height?: number;
  /** Layout from the parent, e.g. flex share in a row. */
  style?:  ViewStyle;
}

const DIMENSIONS: Segment<ContentDimension>[] = [
  { value: 'type',     label: 'Type' },
  { value: 'subjects', label: 'Subjects' },
  { value: 'styles',   label: 'Styles' },
];

const COLUMN_LABEL: Record<ContentDimension, string> = {
  type:     'Type',
  subjects: 'Topic',
  styles:   'Style',
};

/** Under this many tagged posts a donut says nothing, so only the list shows. */
const FEW_POSTS = 5;

const SLICE_NOUN: Record<ContentDimension, string> = {
  type:     'types',
  subjects: 'subjects',
  styles:   'styles',
};

export function ContentCard({ content, range, height, style }: Props) {
  const { isMobile } = useAccountLayout();
  // A dimension with a single slice says nothing (every TikTok post is a
  // video), so its tab is hidden until there is something to compare.
  const segments = DIMENSIONS.filter(d => content[d.value].slices.length > 1);
  const [picked, setDimension] = useState<ContentDimension>('subjects');
  const dimension = segments.some(d => d.value === picked) ? picked : (segments[0]?.value ?? picked);
  const breakdown = content[dimension];
  const groups = useMemo(() => groupSlices(breakdown.slices), [breakdown.slices]);
  const prevLabel = prevPeriodLabel(range);
  // New slices (dimension or data) → nothing highlighted.
  const highlight = useSliceHighlight(breakdown);

  const donut = (
    <ContentDonut
      breakdown={breakdown}
      groups={groups}
      sliceNoun={SLICE_NOUN[dimension]}
      activeKey={highlight.activeKey}
      onSliceHover={highlight.hover}
      onSlicePress={highlight.toggle}
    />
  );
  const table = (
    <ContentTable
      slices={breakdown.slices}
      groups={groups}
      columnLabel={COLUMN_LABEL[dimension]}
      prevLabel={prevLabel}
      highlight={highlight}
    />
  );

  const fewPosts = breakdown.taggedPosts < FEW_POSTS;
  const notes = [
    fewPosts && breakdown.taggedPosts > 0
      ? `Only ${breakdown.taggedPosts} tagged ${breakdown.taggedPosts === 1 ? 'post' : 'posts'} in this period, so there is no chart.`
      : null,
    breakdown.untaggedPosts > 0
      ? `${breakdown.untaggedPosts} of ${breakdown.totalPosts} posts are not tagged yet and are left out.`
      : null,
  ].filter(Boolean) as string[];

  const body = (
    <>
      <ContentSummary breakdown={breakdown} />
      {fewPosts ? table : isMobile ? <>{table}{donut}</> : <>{donut}{table}</>}
      {notes.map(n => <Text key={n} style={styles.note}>{n}</Text>)}
    </>
  );

  return (
    <AccountWidget
      height={height}
      style={style}
      infoText="Every post is tagged by type, subject and style. Slices show how often each one is used, as a share of all tags, so they add up to 100%. Subjects are grouped under their main topic unless a subtopic stands out. Avg views is the average for posts with that tag. Small slices are grouped into Other."
    >
      <WidgetHeader
        kicker="Content types / subjects / styles"
        kickerColor={neutral.textMid}
        title="Content"
        right={<SegmentedControl segments={segments} value={dimension} onChange={setDimension} />}
      />
      {height != null ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={styles.body}>{body}</View>
      )}
    </AccountWidget>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex:      1,
    minHeight: 0,
  },
  body: {
    gap: spacing.base,
  },
  note: {
    ...type.body,
    fontSize: 13,
    color:    neutral.textMid,
  },
});
