import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { breakpoints } from '@/theme/breakpoints';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { MotiView } from 'moti';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { PagerControls, pagerText } from '@/components/primitives/PagerControls';
import { VideoModal } from './VideoModal';
import { PostDetail } from '@/components/post/detail/PostDetail';
import { POST_DETAIL_HEIGHT } from '@/components/post/detail/postDetailLayout';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, party, glass, accent, colourFor } from '@/theme/colors';
import type { GroupKey } from '@/theme/colors';
import { useTenant } from '@/hooks/useTenant';
import { labelForGroupKey } from '@/data/grouping';
import { type, font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { PostRecord, PostBenchmarks } from '@/data/types';
import { track } from '@/lib/analytics';
import { fmtLabel } from '@/lib/format';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AdvancedFilterPanel } from './AdvancedFilterPanel';
import type { FeedFilters } from '@/data/usePostsData';
import { applyAdvancedFilter, type Rule } from '@/lib/advancedFilters';

/**
 * PostsTable
 * -----------
 * Card-based post feed for the current period.
 * Filters: political alignment (Left / Right / Independent) + party + active politician.
 * Leaderboard selection flows in via activePoliticianName.
 * Each card: large 9:16 cover | identity + caption + tags + stats | AI summary column.
 * One job: show the full post ledger clearly.
 */

// ── Political alignment map ────────────────────────────────────────────────────

type Wing = 'left' | 'right' | 'independent';

// Party keys only — the wing filter is a UK-tenant concept. A region key (or
// any unmapped party) has no wing, so wingOf() falls back to 'independent'.
const WING_MAP: Partial<Record<GroupKey, Wing>> = {
  labour:       'left',
  libdem:       'left',
  snp:          'left',
  green:        'left',
  plaid:        'left',
  sinnfein:     'left',
  sdlp:         'left',
  workers:      'left',
  yourparty:    'left',
  conservative: 'right',
  reform:       'right',
  dup:          'right',
  uup:          'right',
  tuv:          'right',
  advance:      'right',
  restore:      'right',
  alliance:     'independent',
  independent:  'independent',
  unknown:      'independent',
};

const WING_LABELS: Record<Wing, string> = {
  left:        'Left wing',
  right:       'Right wing',
  independent: 'Independent',
};

// ── Sort options ───────────────────────────────────────────────────────────────

type SortKey = 'views' | 'likes' | 'comments' | 'shares' | 'postDate' | 'virality' | 'engagement';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'views',      label: 'Views' },
  { key: 'likes',      label: 'Likes' },
  { key: 'comments',   label: 'Comments' },
  { key: 'shares',     label: 'Shares' },
  { key: 'engagement', label: 'Eng. %' },
  { key: 'virality',   label: 'Virality' },
  { key: 'postDate',   label: 'Date' },
];

/** Virality = views per follower. Small accounts that punched above their weight rank highest. */
function viralityRatio(p: PostRecord): number {
  return p.accountFollowers > 0 ? p.views / p.accountFollowers : 0;
}

/** Engagement rate = (likes + comments + saves + shares) / views. Zero-views → 0 to avoid divide-by-zero. */
function engagementRate(p: PostRecord): number {
  return p.views > 0 ? (p.likes + p.comments + p.saves + p.shares) / p.views : 0;
}

/** Page size for the post feed — clicks on Next show this many more. */
const POSTS_PER_PAGE = 20;

// ── Threshold options for min-views / min-likes filters ────────────────────────

const VIEW_THRESHOLDS: { value: number; label: string }[] = [
  { value: 0,         label: 'Any' },
  { value: 1_000,     label: '1k+' },
  { value: 10_000,    label: '10k+' },
  { value: 100_000,   label: '100k+' },
  { value: 1_000_000, label: '1M+' },
];

const LIKE_THRESHOLDS: { value: number; label: string }[] = [
  { value: 0,       label: 'Any' },
  { value: 100,     label: '100+' },
  { value: 1_000,   label: '1k+' },
  { value: 10_000,  label: '10k+' },
  { value: 100_000, label: '100k+' },
];

// ── Group label helper ─────────────────────────────────────────────────────────

/** Hand-written short labels for UK parties; other modes defer to the adapter. */
function groupLabel(key: GroupKey, mode: 'party' | 'region' = 'party'): string {
  if (mode !== 'party') return labelForGroupKey(mode, key);
  const labels: Partial<Record<GroupKey, string>> = {
    labour: 'Labour', conservative: 'Conservative', libdem: 'Lib Dems',
    snp: 'SNP', green: 'Greens', reform: 'Reform', plaid: 'Plaid',
    dup: 'DUP', sinnfein: 'Sinn Féin',
    alliance: 'Alliance', sdlp: 'SDLP', uup: 'UUP', tuv: 'TUV',
    workers: 'Workers Party', advance: 'Advance UK', restore: 'Restore Britain',
    yourparty: 'Your Party',
    independent: 'Independent', unknown: 'Unknown',
  };
  return labels[key] ?? key;
}

/**
 * Parties that should always appear as filter chips even if no posts in the
 * current scope match. Useful for big-name parties the user expects to see
 * (Lib Dems specifically — small post volume, was being silently hidden).
 */
const ALWAYS_VISIBLE_PARTIES: GroupKey[] = [
  'labour', 'conservative', 'libdem', 'reform', 'green', 'snp',
  'plaid', 'dup', 'sinnfein', 'alliance', 'sdlp', 'uup', 'tuv',
  'workers', 'advance', 'restore', 'yourparty',
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  posts:                  PostRecord[];
  loading:                boolean;
  rangeLabel?:            string;
  activePoliticianName?:  string | null;
  /** Active politician account handle — stable identity used for filtering. */
  activePoliticianHandle?: string | null;
  onClearPolitician?:     () => void;
  benchmarks?:            PostBenchmarks;
  /** When false, the post feed is hidden behind a registration gate. */
  isRegistered?:          boolean;
  /** Controlled party filter — set externally (e.g. from PartyLeaderboard). */
  externalPartyFilter?:   GroupKey | null;
  onPartyFilterChange?:   (pk: GroupKey | null) => void;
  /** Controlled style filter — set externally (e.g. from StyleBreakdown). */
  externalStyleFilter?:   string | null;
  onStyleFilterChange?:   (style: string | null) => void;
  /** Controlled sort key — when supplied, the API receives this as ?sortKey=
   *  and returns the top-N for that metric. Without it, sort stays local. */
  externalSortKey?:       SortKey;
  onSortKeyChange?:       (key: SortKey) => void;
  /** Server-side pagination: whether another page is available. */
  hasMore?:               boolean;
  /** True while the next page is being fetched. */
  loadingMore?:           boolean;
  /** Fetch and append the next server page. */
  onLoadMore?:            () => void;
  /** When true, render admin-only inline controls (e.g. summary editing). */
  isAdmin?:               boolean;
  /** Reports the active structured filters so they can be applied server-side. */
  onFiltersChange?:       (f: FeedFilters) => void;
  /** Whole-table count of matching rows (server-side); drives the real total. */
  total?:                 number | null;
}

export function PostsTable({
  posts,
  loading,
  rangeLabel,
  activePoliticianName,
  activePoliticianHandle,
  onClearPolitician,
  benchmarks,
  isRegistered = false,
  externalPartyFilter,
  onPartyFilterChange,
  externalStyleFilter,
  onStyleFilterChange,
  externalSortKey,
  onSortKeyChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  isAdmin = false,
  onFiltersChange,
  total,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < breakpoints.tablet;

  // What this tenant groups by: parties (The Knox Index) or regions (World
  // Leaders). Drives the chip labels and hides the UK-only alignment filter.
  const tenant      = useTenant();
  const mode        = tenant.grouping.mode;
  const isPartyMode = mode === 'party';
  const groupNoun   = tenant.grouping.label;

  // Sort key is controlled when externalSortKey is supplied (parent owns it so
  // it can drive the API's ORDER BY). Otherwise we keep an internal fallback
  // for back-compatibility with callers that don't lift the sort state.
  const [internalSortKey, setInternalSortKey] = useState<SortKey>('views');
  const sortKey = externalSortKey !== undefined ? externalSortKey : internalSortKey;
  const setSortKey = useCallback((next: SortKey) => {
    setInternalSortKey(next);
    onSortKeyChange?.(next);
  }, [onSortKeyChange]);

  const [wingFilter, setWingFilter]   = useState<Wing | null>(null);
  const [internalPartyFilter, setInternalPartyFilter] = useState<GroupKey | null>(null);

  // Use external party filter if provided (controlled), otherwise internal
  const partyFilter = externalPartyFilter !== undefined ? externalPartyFilter : internalPartyFilter;
  const setPartyFilter = useCallback((pk: GroupKey | null) => {
    setInternalPartyFilter(pk);
    onPartyFilterChange?.(pk);
  }, [onPartyFilterChange]);
  const [minViews, setMinViews]     = useState<number>(0);
  const [minLikes, setMinLikes]     = useState<number>(0);
  const [internalStyleFilter, setInternalStyleFilter] = useState<string | null>(null);
  // External style filter (from StyleBreakdown) takes precedence when supplied.
  const styleFilter = externalStyleFilter !== undefined ? externalStyleFilter : internalStyleFilter;
  const setStyleFilter = useCallback((s: string | null) => {
    setInternalStyleFilter(s);
    onStyleFilterChange?.(s);
  }, [onStyleFilterChange]);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  // `selected` carries the post AND the feed position at time of press, so
  // VideoModal can stamp position_in_feed on its analytics events. Keeping
  // them together avoids a race where filter/sort changes the index while
  // the modal is open.
  const [selected, setSelected]     = useState<{ post: PostRecord; positionInFeed: number } | null>(null);

  // Draggable order — starts from filtered; resets when filters or sort change.
  const [orderedPosts, setOrderedPosts] = useState<PostRecord[]>([]);

  // Pagination — show POSTS_PER_PAGE posts at a time; click Next/Previous to page.
  // Resets to page 0 whenever filters or sort change so users aren't stranded
  // on an out-of-range page after narrowing the result set.
  const [pageIndex, setPageIndex] = useState(0);

  // Advanced filter — toggleable panel of arbitrary rules (field/op/value).
  // Rules are AND-combined and applied as the LAST filter step so the existing
  // chip filters narrow the base set first, then advanced rules refine it.
  const [advancedRules, setAdvancedRules]     = useState<Rule[]>([]);
  const [advancedVisible, setAdvancedVisible] = useState(false);

  // Ref tracking current filtered count — lets handlers access it without
  // a stale-closure problem and without needing filtered to be declared first.
  const filteredCountRef = useRef(0);

  // Area 5: tracked filter/sort handlers
  const handleSortKey = useCallback((key: SortKey) => {
    track('post_sort_changed', { sort_key: key, previous_sort_key: sortKey });
    setSortKey(key);
  }, [sortKey]);

  const handleMinViews = useCallback((v: number) => {
    track('view_threshold_changed', { threshold: v, result_count: filteredCountRef.current });
    setMinViews(v);
  }, []);

  const handleMinLikes = useCallback((v: number) => {
    track('like_threshold_changed', { threshold: v, result_count: filteredCountRef.current });
    setMinLikes(v);
  }, []);

  // Party chips show:
  //   1. Every party that has posts in the current wing-filtered scope
  //   2. Plus the ALWAYS_VISIBLE_PARTIES list (filtered by wing if active),
  //      so big-name parties like Lib Dems are visible even with zero posts.
  const parties = useMemo<GroupKey[]>(() => {
    const base = wingFilter ? posts.filter(p => WING_MAP[p.groupKey] === wingFilter) : posts;

    // Count distinct accounts per party so we can order by party size.
    const accountsByParty = new Map<GroupKey, Set<string>>();
    base.forEach(p => {
      if (!accountsByParty.has(p.groupKey)) accountsByParty.set(p.groupKey, new Set());
      accountsByParty.get(p.groupKey)!.add(p.politicianName);
    });

    const seen = new Set<GroupKey>(accountsByParty.keys());

    // Add the always-visible UK parties, respecting the current wing filter.
    // Party-mode only: pinning 'Labour' onto a region dashboard would show a
    // chip that can never match a post.
    if (isPartyMode) {
      for (const pk of ALWAYS_VISIBLE_PARTIES) {
        if (!wingFilter || WING_MAP[pk] === wingFilter) {
          seen.add(pk);
        }
      }
    }

    // Order by account count descending (biggest party first); empty
    // always-visible parties fall to the end. Alphabetical tie-break.
    const countFor = (pk: GroupKey) => accountsByParty.get(pk)?.size ?? 0;
    return Array.from(seen).sort((a, b) => {
      const diff = countFor(b) - countFor(a);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }, [posts, wingFilter, isPartyMode]);

  const filtered = useMemo(() => {
    let base = posts;
    if (activePoliticianHandle || activePoliticianName) {
      const wantHandle = (activePoliticianHandle ?? '').replace(/^@+/, '').trim().toLowerCase();
      base = wantHandle
        ? base.filter(p => (p.profile ?? '').replace(/^@+/, '').trim().toLowerCase() === wantHandle)
        : base.filter(p => p.politicianName === activePoliticianName);
    }
    if (wingFilter) {
      base = base.filter(p => WING_MAP[p.groupKey] === wingFilter);
    }
    if (partyFilter) {
      base = base.filter(p => p.groupKey === partyFilter);
    }
    if (minViews > 0) {
      base = base.filter(p => p.views >= minViews);
    }
    if (minLikes > 0) {
      base = base.filter(p => p.likes >= minLikes);
    }
    if (styleFilter) {
      const sf = styleFilter.toLowerCase();
      base = base.filter(p => (p.styles ?? []).some(s => s.toLowerCase() === sf));
    }
    if (topicFilter) {
      const tf = topicFilter.toLowerCase();
      base = base.filter(p => (p.topics ?? []).some(t => t.toLowerCase() === tf));
    }
    if (advancedRules.length > 0) {
      base = applyAdvancedFilter(base, advancedRules);
    }
    return [...base].sort((a, b) => {
      if (sortKey === 'postDate')   return b.postDate.localeCompare(a.postDate);
      if (sortKey === 'virality')   return viralityRatio(b) - viralityRatio(a);
      if (sortKey === 'engagement') return engagementRate(b) - engagementRate(a);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
  }, [posts, sortKey, wingFilter, partyFilter, activePoliticianName, activePoliticianHandle, minViews, minLikes, styleFilter, topicFilter, advancedRules]);

  // Report active structured filters upward so usePostsData applies them across
  // the whole table (not just the loaded page). wing + advanced rules stay
  // client-side and are handled in `filtered` above.
  useEffect(() => {
    onFiltersChange?.({
      group:      partyFilter ?? null,
      profile:    (activePoliticianHandle ?? '').replace(/^@+/, '').trim().toLowerCase() || null,
      minViews,
      minLikes,
      style:      styleFilter ?? null,
      topic:      topicFilter ?? null,
    });
  }, [partyFilter, activePoliticianHandle, activePoliticianName, minViews, minLikes, styleFilter, topicFilter, onFiltersChange]);

  // Headline total: prefer the server whole-table count, but fall back to the
  // loaded/filtered length when client-only filters (wing, advanced rules) are
  // active, since the server total does not reflect those.
  const clientOnlyFilterActive = !!wingFilter || advancedRules.length > 0;
  const feedTotal = (!clientOnlyFilterActive && typeof total === 'number') ? total : filtered.length;
  const feedTotalApprox = clientOnlyFilterActive && hasMore;

  // Keep the ref in sync so analytics handlers always read the current count.
  filteredCountRef.current = filtered.length;

  // Reset to page 0 whenever the filtered set changes (so user isn't stuck on
  // an empty page after narrowing the filters).
  useEffect(() => {
    setPageIndex(0);
  }, [filtered]);

  // Slice the filtered list down to a single page of POSTS_PER_PAGE items.
  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedPosts = useMemo(
    () => filtered.slice(safePageIndex * POSTS_PER_PAGE, (safePageIndex + 1) * POSTS_PER_PAGE),
    [filtered, safePageIndex]
  );

  // Sync draggable list with the current page (not the full filtered set).
  useEffect(() => {
    setOrderedPosts(pagedPosts);
  }, [pagedPosts]);

  const goToPrevPage = useCallback(() => {
    setPageIndex(p => Math.max(0, p - 1));
    track('post_feed_paginated', { direction: 'prev', to_page: safePageIndex });
  }, [safePageIndex]);

  const goToNextPage = useCallback(() => {
    // At the last loaded page: pull the next server page (and step forward so the
    // new posts show once they arrive). Otherwise just advance the local page.
    if (safePageIndex >= totalPages - 1) {
      if (hasMore && onLoadMore) {
        onLoadMore();
        setPageIndex(p => p + 1);
        track('post_feed_paginated', { direction: 'next', to_page: safePageIndex + 2, loaded_more: true });
      }
      return;
    }
    setPageIndex(p => Math.min(totalPages - 1, p + 1));
    track('post_feed_paginated', { direction: 'next', to_page: safePageIndex + 2 });
  }, [safePageIndex, totalPages, hasMore, onLoadMore]);

  // Area 6: fire post_card_opened with position and metadata
  const handleCardPress = useCallback((post: PostRecord, index: number) => {
    track('post_card_opened', {
      post_id:         post.postId,
      politician_name: post.politicianName,
      party:           post.groupKey,
      views:           post.views,
      likes:           post.likes,
      has_video:       Boolean(post.videoMp4),
      position_in_feed: index,
      sort_key:        sortKey,
    });
    // Snapshot position alongside the post so VideoModal can stamp it on
    // downstream events (video_opened/play/closed/tiktok_link_tapped).
    setSelected({ post, positionInFeed: index });
  }, [sortKey]);

  // Area 5: alignment filter — also clears party to avoid empty stale combinations
  const handleWingChange = useCallback((w: Wing | null) => {
    track('alignment_filter_changed', {
      wing:         w ?? 'all',
      result_count: filteredCountRef.current,
    });
    setWingFilter(w);
    setPartyFilter(null);
  }, []);

  const handlePartyFilter = useCallback((pk: GroupKey | null) => {
    track('party_filter_changed', {
      party:        pk ?? 'all',
      result_count: filteredCountRef.current,
      source:       'feed_chips',
    });
    setPartyFilter(pk);
  }, []);

  const handleStyleFilter = useCallback((style: string | null) => {
    track('style_filter_changed', { style: style ?? 'all', result_count: filteredCountRef.current });
    // Toggle: tap the same style again to clear
    const next = style && styleFilter?.toLowerCase() === style.toLowerCase() ? null : style;
    setStyleFilter(next);
  }, [styleFilter, setStyleFilter]);

  const handleTopicFilter = useCallback((topic: string | null) => {
    track('topic_filter_changed', { topic: topic ?? 'all', result_count: filteredCountRef.current });
    setTopicFilter(prev => prev?.toLowerCase() === topic?.toLowerCase() ? null : topic);
  }, []);

  // Render item for DraggableFlatList.
  const renderItem = useCallback(({ item: post, getIndex, drag, isActive }: RenderItemParams<PostRecord>) => {
    const index = getIndex() ?? 0;
    return (
      <ScaleDecorator activeScale={1.03}>
        <PostCard
          post={post}
          index={index}
          benchmarks={benchmarks}
          onPress={() => !isActive && handleCardPress(post, index)}
          drag={drag}
          isActive={isActive}
          compact={isMobile}
          activeStyleFilter={styleFilter}
          activeTopicFilter={topicFilter}
          onStylePress={handleStyleFilter}
          onTopicPress={handleTopicFilter}
          sortKey={sortKey}
          isAdmin={isAdmin}
        />
      </ScaleDecorator>
    );
  }, [benchmarks, isMobile, handleCardPress, styleFilter, topicFilter, handleStyleFilter, handleTopicFilter, sortKey, isAdmin]);

  return (
    <DashCard style={styles.wrap} topAccent={undefined}>
      <DevLabel name="PostsTable" />

      <View style={styles.inner}>

        {/* ── Header: title + sort chips ─────────────── */}
        <View style={styles.header}>
          <View>
            <Kicker tone='dim'>ALL POSTS</Kicker>
            <View style={styles.titleRow}>
              <Title style={{ fontSize: 20 }}>
                Post Feed
                {rangeLabel ? <Text style={styles.titleRange}> · {rangeLabel}</Text> : null}
              </Title>
              {/* Result count — updates immediately so users can see the filter is working */}
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{feedTotal}</Text>
              </View>
              {/* Magnifying glass — toggles the AdvancedFilterPanel below */}
              <Pressable
                onPress={() => {
                  const next = !advancedVisible;
                  setAdvancedVisible(next);
                  track('advanced_filter_toggled', { open: next, rule_count: advancedRules.length });
                }}
                style={({ pressed, hovered }: any) => [
                  styles.advFilterBtn,
                  advancedVisible && styles.advFilterBtnActive,
                  advancedRules.length > 0 && styles.advFilterBtnHasRules,
                  hovered && { opacity: 0.85 },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel="Toggle advanced filter"
              >
                <FontAwesome6
                  name="magnifying-glass"
                  size={12}
                  color={advancedVisible || advancedRules.length > 0 ? accent.indigo : neutral.textMid}
                  solid
                />
                {advancedRules.length > 0 && (
                  <View style={styles.advFilterCount}>
                    <Text style={styles.advFilterCountText}>{advancedRules.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {SORT_OPTIONS.map(s => {
              const isActive = s.key === sortKey;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => handleSortKey(s.key)}
                  style={({ pressed }) => [
                    styles.sortChip,
                    isActive && styles.sortChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Alignment filter (party-grouped tenants only) ───────── */}
        {isPartyMode && (
        <View style={styles.filterSection}>
          <View style={styles.filterLabelRow}>
            <Text style={styles.filterLabel}>ALIGNMENT</Text>
            <InfoTip text="Filter posts by the political leaning of the party. Left wing includes Labour, Lib Dem, SNP, Greens, Plaid and Sinn Féin. Right wing includes Conservative, Reform and DUP." />
          </View>
          <View style={styles.filterChips}>
            <Pressable
              onPress={() => handleWingChange(null)}
              style={({ pressed }) => [
                styles.alignChip,
                wingFilter === null && styles.alignChipAll,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.alignChipText, wingFilter === null && styles.alignChipTextAll]}>
                All
              </Text>
            </Pressable>
            {(['left', 'right', 'independent'] as Wing[]).map(w => {
              const active = wingFilter === w;
              const tint = w === 'left' ? accent.mint : w === 'right' ? accent.indigo : neutral.textMid;
              return (
                <Pressable
                  key={w}
                  onPress={() => handleWingChange(active ? null : w)}
                  style={({ pressed }) => [
                    styles.alignChip,
                    active && { borderColor: tint, backgroundColor: tint + '20' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.alignChipText, active && { color: tint }]}>
                    {WING_LABELS[w]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        )}

        {/* ── Group filter ───────────────────────────── */}
        {parties.length > 1 && (
          <View style={styles.filterSection}>
            <View style={styles.filterLabelRow}>
              <Text style={styles.filterLabel}>{groupNoun.toUpperCase()}</Text>
              <InfoTip text={`Narrow the feed to posts from a single ${groupNoun.toLowerCase()}. Only ${groupNoun.toLowerCase()}s present in the current time period are shown.`} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {parties.map(pk => {
                const colour = colourFor(pk);
                const active = partyFilter === pk;
                return (
                  <Pressable
                    key={pk}
                    onPress={() => handlePartyFilter(active ? null : pk)}
                    style={({ pressed }) => [
                      styles.partyChip,
                      active && { borderColor: colour.base, backgroundColor: colour.base + '22' },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={[styles.partyDot, { backgroundColor: colour.base }]} />
                    <Text style={[styles.partyChipText, active && { color: colour.glow }]}>
                      {groupLabel(pk, mode)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Min views / min likes thresholds ───────── */}
        <View style={styles.filterSection}>
          <View style={styles.filterLabelRow}>
            <Text style={styles.filterLabel}>MIN VIEWS</Text>
            <InfoTip text="Hide posts that fall below this view threshold. Useful when you only care about posts that broke through." />
          </View>
          <View style={styles.filterChips}>
            {VIEW_THRESHOLDS.map(t => {
              const active = minViews === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => handleMinViews(t.value)}
                  style={({ pressed }) => [
                    styles.alignChip,
                    active && { borderColor: accent.indigo, backgroundColor: accent.indigo + '20' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.alignChipText, active && { color: accent.indigo }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterLabelRow}>
            <Text style={styles.filterLabel}>MIN LIKES</Text>
            <InfoTip text="Hide posts that fall below this like threshold. Surfaces only content that genuinely resonated." />
          </View>
          <View style={styles.filterChips}>
            {LIKE_THRESHOLDS.map(t => {
              const active = minLikes === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => handleMinLikes(t.value)}
                  style={({ pressed }) => [
                    styles.alignChip,
                    active && { borderColor: accent.indigo, backgroundColor: accent.indigo + '20' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.alignChipText, active && { color: accent.indigo }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Active politician pill ─────────────────── */}
        {activePoliticianName ? (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>SHOWING</Text>
            <Pressable onPress={onClearPolitician} style={styles.polPill}>
              <Text style={styles.polPillText}>{activePoliticianName}</Text>
              <Text style={styles.polPillClose}>×</Text>
            </Pressable>
            <Text style={styles.filterHint}>Tap × to show all politicians</Text>
          </View>
        ) : null}

        {/* ── Advanced filter panel — toggled by the magnifying-glass button ─ */}
        <AdvancedFilterPanel
          visible={advancedVisible}
          rules={advancedRules}
          onChange={setAdvancedRules}
          onClose={() => setAdvancedVisible(false)}
        />

        {/* ── Active style / topic pills ────────────── */}
        {(styleFilter || topicFilter) ? (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>TAGGED</Text>
            <View style={styles.filterChips}>
              {styleFilter ? (
                <Pressable onPress={() => setStyleFilter(null)} style={styles.tagFilterPill}>
                  <Text style={styles.tagFilterPillText}>{fmtLabel(styleFilter)}</Text>
                  <Text style={styles.polPillClose}>×</Text>
                </Pressable>
              ) : null}
              {topicFilter ? (
                <Pressable onPress={() => setTopicFilter(null)} style={styles.tagFilterPill}>
                  <Text style={styles.tagFilterPillText}>{fmtLabel(topicFilter)}</Text>
                  <Text style={styles.polPillClose}>×</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Registration gate ────────────────────── */}
        {!isRegistered && (
          <View style={styles.lockedWrap}>
            <Text style={styles.lockedTitle}>Post feed is locked</Text>
            <Text style={styles.lockedBody}>
              Register free to access every post, filter by party, and sort by views, likes, virality and more.
            </Text>
          </View>
        )}

        {/* ── Card list — draggable + snapping ─────── */}
        {isRegistered && (
          loading && posts.length === 0 ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map(i => (
                <SkeletonBlock key={i} height={CARD_H} borderRadius={14} />
              ))}
            </View>
          ) : orderedPosts.length === 0 ? (
            <Text style={styles.emptyText}>No posts match the current filters.</Text>
          ) : (
            <>
              <DraggableFlatList
                data={orderedPosts}
                keyExtractor={item => item.postId}
                renderItem={renderItem}
                onDragEnd={({ data }) => setOrderedPosts(data)}
                style={isMobile ? styles.listCompact : styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                {...(!isMobile && {
                  snapToInterval: CARD_H + GAP,
                  decelerationRate: 'fast' as const,
                  snapToAlignment: 'start' as const,
                  disableIntervalMomentum: true,
                })}
                activationDistance={8}
              />

              {/* ── Pagination controls ──────────────────── */}
              {(() => {
                const atEnd        = safePageIndex >= totalPages - 1;
                const nextDisabled = (atEnd && !hasMore) || loadingMore;
                const label        = loadingMore ? 'Loading…' : atEnd && hasMore ? 'Load more →' : 'Next →';
                return (
                  <PagerControls
                    onPrev={goToPrevPage}
                    onNext={goToNextPage}
                    prevDisabled={safePageIndex === 0}
                    nextDisabled={nextDisabled}
                    nextLabel={label}
                  >
                    <Text style={pagerText.info}>
                      Page <Text style={pagerText.strong}>{safePageIndex + 1}</Text> of {totalPages}{hasMore ? '+' : ''}
                      <Text style={pagerText.muted}>  ·  {feedTotal}{feedTotalApprox ? '+' : ''} post{feedTotal === 1 ? '' : 's'}</Text>
                    </Text>
                  </PagerControls>
                );
              })()}
            </>
          )
        )}
      </View>

      {selected ? (
        <VideoModal
          visible
          videoMp4={selected.post.videoMp4}
          coverJpeg={selected.post.coverJpeg}
          caption={selected.post.caption}
          postUrl={selected.post.postUrl}
          postId={selected.post.postId}
          politicianName={selected.post.politicianName}
          groupKey={selected.post.groupKey}
          views={selected.post.views}
          styles={selected.post.styles}
          positionInFeed={selected.positionInFeed}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </DashCard>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

interface CardProps {
  post:              PostRecord;
  index:             number;
  benchmarks?:       PostBenchmarks;
  onPress:           () => void;
  drag?:             () => void;
  isActive?:         boolean;
  /** compact=true → stacked layout for narrow screens */
  compact?:          boolean;
  activeStyleFilter?: string | null;
  activeTopicFilter?: string | null;
  onStylePress?:     (style: string) => void;
  onTopicPress?:     (topic: string) => void;
  /** Current sort key — included in post_dwell event for analytics context */
  sortKey?:          SortKey;
  /** Admin viewer → show inline summary editing. */
  isAdmin?:          boolean;
}

/**
 * Minimum dwell to record. Posts mount briefly during list windowing/recycling
 * and during fast scrolls — anything under 500ms is noise, not attention.
 */
const POST_DWELL_MIN_MS = 500;

function PostCard({ post, index, benchmarks, onPress, drag, isActive, compact, activeStyleFilter, activeTopicFilter, onStylePress, onTopicPress, sortKey, isAdmin }: CardProps) {
  const colour = colourFor(post.groupKey);

  // Dwell tracking: mount → unmount measures how long this card was on screen
  // during the user's session. Fires on unmount (scroll-past, filter change,
  // page navigation). Captures attention even for posts the user never clicks.
  // Capped to POST_DWELL_MIN_MS to suppress windowing/recycle noise.
  const dwellStartRef = useRef<number>(Date.now());
  useEffect(() => {
    // Snapshot props at effect setup time so the cleanup can read them after
    // the component has begun unmounting (React would otherwise null them out).
    const startTs       = dwellStartRef.current;
    const postId        = post.postId;
    const politicianName = post.politicianName;
    const groupKey      = post.groupKey;
    const positionInFeed = index;
    const sortKeySnap   = sortKey;

    return () => {
      const dwellMs = Date.now() - startTs;
      if (dwellMs < POST_DWELL_MIN_MS) return;
      track('post_dwell', {
        post_id:          postId,
        politician_name:  politicianName,
        party:            groupKey,
        dwell_ms:         dwellMs,
        position_in_feed: positionInFeed,
        sort_key:         sortKeySnap ?? null,
      });
    };
    // Empty deps: we only want this to fire once on unmount. Re-renders due to
    // sort/filter changes that keep the same post mounted are still part of the
    // same dwell session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240, delay: Math.min(index * 22, 440) }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }: any) => [
          compact ? styles.cardCompact : styles.postCard,
          isActive && styles.cardDragging,
          hovered && { borderColor: colour.base },
          pressed && { opacity: 0.84 },
        ]}
      >
        <PostDetail
          post={post}
          groupLabel={groupLabel(post.groupKey)}
          benchmarks={benchmarks}
          compact={compact}
          height={CARD_H}
          isAdmin={isAdmin}
          activeStyle={activeStyleFilter}
          activeTopic={activeTopicFilter}
          onStylePress={onStylePress}
          onTopicPress={onTopicPress}
        />
      </Pressable>
    </MotiView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_H  = POST_DETAIL_HEIGHT;                // card height = viewport window
const GAP = 40 ; // set the gap between the snapping elements

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  inner: { padding: spacing.lg, gap: spacing.md },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },

  // ── Advanced filter button ─────────────────────────────────────────────────
  advFilterBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    width:           32,
    height:          32,
    justifyContent:  'center',
    borderRadius:    radius.pill,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  advFilterBtnActive: {
    borderColor:     accent.indigo,
    backgroundColor: accent.indigo + '20',
  },
  advFilterBtnHasRules: {
    width:             'auto' as any,
    paddingHorizontal: 8,
  },
  advFilterCount: {
    backgroundColor:   accent.indigo,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:      radius.pill,
    minWidth:          16,
    alignItems:        'center',
  },
  advFilterCountText: {
    fontFamily: font.bold,
    fontSize:   9,
    color:      '#fff',
  },
  titleRange: { ...type.body, color: neutral.textDim, fontSize: 16 },
  countBadge: {
    backgroundColor: accent.indigo + '22',
    borderWidth: 1,
    borderColor: accent.indigo + '55',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: font.mono,
    fontSize: 12,
    color: accent.indigo,
  },

  // Sort chips
  chipRow: { gap: spacing.sm, alignItems: 'center' },
  sortChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  sortChipActive: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.12)',
  },
  sortChipText: { ...type.caption, color: neutral.textMid, fontSize: 12 },
  sortChipTextActive: { color: accent.indigo },

  // Filter rows
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterHint: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },

  // Alignment chips
  alignChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '150ms',
      } as any,
      default: {},
    }),
  },
  alignChipAll: {
    borderColor: neutral.strokeHi,
    backgroundColor: glass.fillHi,
  },
  alignChipText: { ...type.caption, color: neutral.textMid, fontSize: 12 },
  alignChipTextAll: { color: neutral.text },

  // Party chips
  partyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '150ms',
      } as any,
      default: {},
    }),
  },
  partyDot: { width: 6, height: 6, borderRadius: 3 },
  partyChipText: { ...type.caption, color: neutral.textMid, fontSize: 12 },

  // Active politician pill
  polPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  polPillText: { ...type.caption, color: accent.indigo, fontSize: 12 },
  polPillClose: { ...type.caption, color: accent.indigo, fontSize: 16, lineHeight: 14 },

  // List — exactly one card visible at a time; snapping handles navigation
  list: { height: CARD_H },
  listCompact: { maxHeight: 2400 },  // on mobile: show up to ~4 cards, scroll freely
  listContent: { paddingBottom: spacing.sm },
  skeletonList: { gap: spacing.sm, paddingBottom: spacing.sm },
  emptyText: { ...type.body, color: neutral.textDim, fontSize: 16, textAlign: 'center', padding: spacing.xl },

  lockedWrap: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedTitle: {
    ...type.title,
    fontSize: 16,
    color: neutral.text,
    textAlign: 'center',
  },
  lockedBody: {
    ...type.body,
    fontSize: 16,
    color: neutral.textMid,
    textAlign: 'center',
    lineHeight: 20,
  },


  // Drag handle — vertical braille-dot grip icon on the left edge of the card
  dragHandle: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRightWidth: 1,
    borderRightColor: glass.border,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'grab' } as any, default: {} }),
  },
  dragIcon: {
    fontSize: 16,
    color: neutral.textDim,
    lineHeight: 18,
  },

  // Card — fixed to CARD_H so it fills the list window exactly; one card = one view
  postCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: CARD_H,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    marginBottom: GAP,
    overflow: 'hidden',
    backgroundColor: glass.card,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color',
        transitionDuration: '160ms',
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  cardDragging: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.08)',
    ...Platform.select({ web: { cursor: 'grabbing' } as any, default: {} }),
  },
  // Compact card — stacked layout for mobile
  cardCompact: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    marginBottom: GAP,
    overflow: 'hidden',
    backgroundColor: glass.card,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },






  tagFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(95,100,189,0.15)',
    borderWidth: 1,
    borderColor: accent.indigo,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagFilterPillText: { fontFamily: font.bold, fontSize: 12, color: accent.indigo },

  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 72,
    flexShrink: 0,
  },

});
