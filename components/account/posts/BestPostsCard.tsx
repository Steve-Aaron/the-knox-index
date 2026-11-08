import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccountWidget } from '@/components/account/layout/AccountWidget';
import { WidgetHeader } from '@/components/account/layout/WidgetHeader';
import { useAccountLayout } from '@/components/account/layout/accountLayout';
import { PostSummaryCard } from '@/components/post/card/PostSummaryCard';
import { accent, colourFor, glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { PostBenchmarks, Politician } from '@/data/types';
import type { AccountPost, SocialProfile } from '@/data/account/types';
import { AdvancedFilterButton } from '@/components/dashboard/AdvancedFilterButton';
import { AdvancedFilterPanel } from '@/components/dashboard/AdvancedFilterPanel';
import type { FieldId } from '@/lib/advancedFilters';
import { PLATFORM_META } from '../platforms';
import { SocialLinks } from '../profile/SocialLinks';
import { BestPostsFilters } from './BestPostsFilters';
import { PostInsightModal } from './PostInsightModal';
import { useBestPosts } from './useBestPosts';

/**
 * BestPostsCard
 * --------------
 * Ranked, filterable list of the account's posts in the selected period.
 * The magnifying glass opens the same advanced filter as the dashboard's
 * Post Feed, limited to the fields an account's own posts have.
 * Tapping a post opens it in the post insight modal, which steps through the
 * same ranked list.
 *
 * One job: compose filters + ranked list with paging + the detail modal.
 */
interface Props {
  posts:      AccountPost[];
  /** Author of every post — colours the cards and fills the modal identity. */
  politician: Politician;
  socials:    SocialProfile[];
  benchmarks?: PostBenchmarks;
}

const PAGE_SIZE = 10;

/** Every post here is the same account's, so name / handle / party say nothing. */
const FILTER_FIELDS: FieldId[] = [
  'caption', 'views', 'likes', 'comments', 'shares', 'saves', 'engagementRate', 'postDate',
];

export function BestPostsCard({ posts, politician, socials, benchmarks }: Props) {
  const {
    visible, sortKey, setSortKey, minViews, setMinViews, minLikes, setMinLikes, rules, setRules,
  } = useBestPosts(posts);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  /** Index into `visible` of the post open in the modal. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { isMobile } = useAccountLayout();
  const colour = colourFor(politician.groupKey);

  // New data or filters → back to the first page.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [posts, sortKey, minViews, minLikes, rules]);

  const remaining = visible.length - shown;

  return (
    <AccountWidget infoText="Posts from the selected period and platforms, ranked by the chosen metric. Tap a post for its detailed insight.">
      <WidgetHeader
        kicker="Best posts"
        title="Best-performing posts"
        titleAccessory={
          // One group, so the count and the search wrap together on mobile.
          <View style={styles.titleAccessory}>
            <CountBadge count={visible.length} />
            <AdvancedFilterButton
              open={filterOpen}
              ruleCount={rules.length}
              onPress={() => setFilterOpen(o => !o)}
            />
          </View>
        }
      />

      <BestPostsFilters
        sortKey={sortKey}
        onSortKey={setSortKey}
        minViews={minViews}
        onMinViews={setMinViews}
        minLikes={minLikes}
        onMinLikes={setMinLikes}
      />

      <AdvancedFilterPanel
        visible={filterOpen}
        rules={rules}
        onChange={setRules}
        onClose={() => setFilterOpen(false)}
        fields={FILTER_FIELDS}
      />

      {visible.length === 0 ? (
        <Text style={styles.empty}>No posts match these filters.</Text>
      ) : (
        <View style={styles.list}>
          {visible.slice(0, shown).map((post, i) => (
            <PostSummaryCard
              key={post.id}
              post={post}
              colour={colour}
              layout={isMobile ? 'narrow' : 'split'}
              platformIcon={PLATFORM_META[post.platform].icon}
              onPress={() => setOpenIndex(i)}
              accessibilityRole="button"
            />
          ))}
        </View>
      )}

      {remaining > 0 ? (
        <Pressable
          onPress={() => setShown(n => n + PAGE_SIZE)}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Text style={styles.moreText}>Load more · {remaining} remaining</Text>
        </Pressable>
      ) : null}

      <View style={styles.socials}>
        <SocialLinks socials={socials} />
      </View>

      <PostInsightModal
        posts={visible}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
        politician={politician}
        socials={socials}
        benchmarks={benchmarks}
      />
    </AccountWidget>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleAccessory: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    ...type.body,
    fontSize:        14,
    color:           neutral.textMid,
    textAlign:       'center',
    paddingVertical: spacing.xl,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       accent.indigo,
    backgroundColor:   'rgba(95,100,189,0.15)',
  },
  badgeText: {
    ...type.caption,
    fontSize: 11,
    color:    accent.indigo,
  },
  more: {
    alignSelf:         'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    backgroundColor:   glass.fill,
  },
  morePressed: {
    backgroundColor: glass.fillHi,
  },
  moreText: {
    ...type.caption,
    fontSize: 11,
    color:    neutral.textMid,
  },
  socials: {
    flexDirection: 'row',
  },
});
