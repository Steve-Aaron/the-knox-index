import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChipGroup, type ChipOption } from '@/components/primitives/ChipGroup';
import { spacing } from '@/theme/spacing';
import type { BestPostsSortKey } from './useBestPosts';

/**
 * BestPostsFilters
 * -----------------
 * Sort chips plus the min-views / min-likes threshold rows.
 *
 * One job: render the best-posts controls (state lives in useBestPosts).
 */
interface Props {
  sortKey:     BestPostsSortKey;
  onSortKey:   (next: BestPostsSortKey) => void;
  minViews:    number;
  onMinViews:  (next: number) => void;
  minLikes:    number;
  onMinLikes:  (next: number) => void;
}

const SORT_OPTIONS: ChipOption<BestPostsSortKey>[] = [
  { value: 'views',          label: 'Views' },
  { value: 'likes',          label: 'Likes' },
  { value: 'comments',       label: 'Comments' },
  { value: 'shares',         label: 'Shares' },
  { value: 'engagementRate', label: 'Eng. %' },
  { value: 'virality',       label: 'Virality' },
  { value: 'postDate',       label: 'Date' },
];

const VIEW_THRESHOLDS: ChipOption<number>[] = [
  { value: 0,         label: 'Any' },
  { value: 1_000,     label: '1K+' },
  { value: 10_000,    label: '10K+' },
  { value: 100_000,   label: '100K+' },
  { value: 1_000_000, label: '1M+' },
];

const LIKE_THRESHOLDS: ChipOption<number>[] = [
  { value: 0,       label: 'Any' },
  { value: 100,     label: '100+' },
  { value: 1_000,   label: '1K+' },
  { value: 10_000,  label: '10K+' },
  { value: 100_000, label: '100K+' },
];

export function BestPostsFilters({
  sortKey,
  onSortKey,
  minViews,
  onMinViews,
  minLikes,
  onMinLikes,
}: Props) {
  return (
    <View style={styles.wrap}>
      <ChipGroup options={SORT_OPTIONS} value={sortKey} onChange={onSortKey} scroll />
      <ChipGroup
        label="Min views"
        infoText="Hide posts below this view count."
        options={VIEW_THRESHOLDS}
        value={minViews}
        onChange={onMinViews}
      />
      <ChipGroup
        label="Min likes"
        infoText="Hide posts below this like count."
        options={LIKE_THRESHOLDS}
        value={minLikes}
        onChange={onMinLikes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
});
