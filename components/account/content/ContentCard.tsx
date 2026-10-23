import React, { useState } from 'react';
import type { ViewStyle } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { SegmentedControl, type Segment } from '@/components/primitives/SegmentedControl';
import { neutral } from '@/theme/colors';
import { prevPeriodLabel } from '@/data/account/periodLabels';
import type { AccountPeriodData, ContentDimension, TimeRange } from '@/data/account/types';
import { ContentDonut } from './ContentDonut';
import { ContentSummary } from './ContentSummary';
import { ContentTable } from './ContentTable';
import { useSliceHighlight } from './useSliceHighlight';

/**
 * ContentCard
 * ------------
 * What the account posts about, sliced by type, subject or style: summary
 * figures, a views-share donut, and the per-slice table. Donut and table
 * share one highlighted slice: hover previews it, press pins it.
 *
 * One job: compose the content breakdown for the chosen dimension.
 */
interface Props {
  content: AccountPeriodData['content'];
  range:   TimeRange;
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

export function ContentCard({ content, range, height, style }: Props) {
  // A dimension with a single slice says nothing (every TikTok post is a
  // video), so its tab is hidden until there is something to compare.
  const segments = DIMENSIONS.filter(d => content[d.value].slices.length > 1);
  const [picked, setDimension] = useState<ContentDimension>('subjects');
  const dimension = segments.some(d => d.value === picked) ? picked : (segments[0]?.value ?? picked);
  const breakdown = content[dimension];
  const prevLabel = prevPeriodLabel(range);
  // New slices (dimension or data) → nothing highlighted.
  const highlight = useSliceHighlight(breakdown);

  return (
    <AccountWidget
      height={height}
      style={style}
      infoText="Every post is tagged by type, subject and style. Slices are sized by views, so you can see what this account's audience actually watches."
    >
      <WidgetHeader
        kicker="Content types / subjects / styles"
        kickerColor={neutral.textMid}
        title="Content"
        right={<SegmentedControl segments={segments} value={dimension} onChange={setDimension} />}
      />
      <ContentSummary breakdown={breakdown} />
      <ContentDonut
        breakdown={breakdown}
        prevLabel={prevLabel}
        activeKey={highlight.activeKey}
        onSliceHover={highlight.hover}
        onSlicePress={highlight.toggle}
      />
      <ContentTable
        slices={breakdown.slices}
        columnLabel={COLUMN_LABEL[dimension]}
        prevLabel={prevLabel}
        scrollable={height != null}
        highlight={highlight}
      />
    </AccountWidget>
  );
}
