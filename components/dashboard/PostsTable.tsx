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
import { LinearGradient } from 'expo-linear-gradient';
import { breakpoints } from '@/theme/breakpoints';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ShimmerImage } from '@/components/primitives/ShimmerImage';
import { MotiView } from 'moti';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { BoxWhisker } from '@/components/primitives/BoxWhisker';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { VideoModal } from './VideoModal';
import { neutral, party, glass, accent } from '@/theme/colors';
import type { PartyKey } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { formatters } from '@/components/primitives/CountUp';
import type { PostRecord, PostBenchmarks } from '@/data/types';
import { track } from '@/lib/analytics';
import { fmtLabel } from '@/lib/format';

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

const WING_MAP: Record<PartyKey, Wing> = {
  labour:       'left',
  libdem:       'left',
  snp:          'left',
  green:        'left',
  plaid:        'left',
  sinnfein:     'left',
  conservative: 'right',
  reform:       'right',
  dup:          'right',
  independent:  'independent',
  unknown:      'independent',
};

const WING_LABELS: Record<Wing, string> = {
  left:        'Left wing',
  right:       'Right wing',
  independent: 'Independent',
};

// ── Sort options ───────────────────────────────────────────────────────────────

type SortKey = 'views' | 'likes' | 'comments' | 'shares' | 'postDate' | 'virality';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'views',    label: 'Views' },
  { key: 'likes',    label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares',   label: 'Shares' },
  { key: 'virality', label: 'Virality' },
  { key: 'postDate', label: 'Date' },
];

/** Virality = views per follower. Small accounts that punched above their weight rank highest. */
function viralityRatio(p: PostRecord): number {
  return p.accountFollowers > 0 ? p.views / p.accountFollowers : 0;
}

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

// ── Party label helper ─────────────────────────────────────────────────────────

function partyLabel(key: PartyKey): string {
  const labels: Partial<Record<PartyKey, string>> = {
    labour: 'Labour', conservative: 'Conservative', libdem: 'Lib Dem',
    snp: 'SNP', green: 'Greens', reform: 'Reform', plaid: 'Plaid',
    dup: 'DUP', sinnfein: 'Sinn Féin', independent: 'Independent', unknown: 'Unknown',
  };
  return labels[key] ?? key;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  posts:                  PostRecord[];
  loading:                boolean;
  rangeLabel?:            string;
  activePoliticianName?:  string | null;
  onClearPolitician?:     () => void;
  benchmarks?:            PostBenchmarks;
  /** When false, the post feed is hidden behind a registration gate. */
  isRegistered?:          boolean;
  /** Controlled party filter — set externally (e.g. from PartyLeaderboard). */
  externalPartyFilter?:   PartyKey | null;
  onPartyFilterChange?:   (pk: PartyKey | null) => void;
  /** Controlled style filter — set externally (e.g. from StyleBreakdown). */
  externalStyleFilter?:   string | null;
  onStyleFilterChange?:   (style: string | null) => void;
}

export function PostsTable({
  posts,
  loading,
  rangeLabel,
  activePoliticianName,
  onClearPolitician,
  benchmarks,
  isRegistered = false,
  externalPartyFilter,
  onPartyFilterChange,
  externalStyleFilter,
  onStyleFilterChange,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < breakpoints.tablet;

  const [sortKey, setSortKey]         = useState<SortKey>('views');
  const [wingFilter, setWingFilter]   = useState<Wing | null>(null);
  const [internalPartyFilter, setInternalPartyFilter] = useState<PartyKey | null>(null);

  // Use external party filter if provided (controlled), otherwise internal
  const partyFilter = externalPartyFilter !== undefined ? externalPartyFilter : internalPartyFilter;
  const setPartyFilter = useCallback((pk: PartyKey | null) => {
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

  // Party chips must only show parties that exist within the active wing filter.
  // Deriving from all posts would let users tap a party that has zero matches
  // in the current wing, silently returning an empty list.
  const parties = useMemo<PartyKey[]>(() => {
    const base = wingFilter ? posts.filter(p => WING_MAP[p.partyKey] === wingFilter) : posts;
    const seen = new Set<PartyKey>();
    base.forEach(p => seen.add(p.partyKey));
    return Array.from(seen).sort();
  }, [posts, wingFilter]);

  const filtered = useMemo(() => {
    let base = posts;
    if (activePoliticianName) {
      base = base.filter(p => p.politicianName === activePoliticianName);
    }
    if (wingFilter) {
      base = base.filter(p => WING_MAP[p.partyKey] === wingFilter);
    }
    if (partyFilter) {
      base = base.filter(p => p.partyKey === partyFilter);
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
    return [...base].sort((a, b) => {
      if (sortKey === 'postDate') return b.postDate.localeCompare(a.postDate);
      if (sortKey === 'virality') return viralityRatio(b) - viralityRatio(a);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
  }, [posts, sortKey, wingFilter, partyFilter, activePoliticianName, minViews, minLikes, styleFilter, topicFilter]);

  // Keep the ref in sync so analytics handlers always read the current count.
  filteredCountRef.current = filtered.length;

  // Sync draggable list when filters or sort key change.
  useEffect(() => {
    setOrderedPosts(filtered);
  }, [filtered]);

  // Area 6: fire post_card_opened with position and metadata
  const handleCardPress = useCallback((post: PostRecord, index: number) => {
    track('post_card_opened', {
      post_id:         post.postId,
      politician_name: post.politicianName,
      party:           post.partyKey,
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

  const handlePartyFilter = useCallback((pk: PartyKey | null) => {
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
        />
      </ScaleDecorator>
    );
  }, [benchmarks, isMobile, handleCardPress, styleFilter, topicFilter, handleStyleFilter, handleTopicFilter, sortKey]);

  return (
    <DashCard style={styles.wrap} topAccent={undefined}>
      <DevLabel name="PostsTable" />

      <View style={styles.inner}>

        {/* ── Header: title + sort chips ─────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>ALL POSTS</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                Post Feed
                {rangeLabel ? <Text style={styles.titleRange}> · {rangeLabel}</Text> : null}
              </Text>
              {/* Result count — updates immediately so users can see the filter is working */}
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{filtered.length}</Text>
              </View>
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

        {/* ── Alignment filter ───────────────────────── */}
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
              const tint = w === 'left' ? accent.mint : w === 'right' ? accent.pink : neutral.textMid;
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

        {/* ── Party filter ───────────────────────────── */}
        {parties.length > 1 && (
          <View style={styles.filterSection}>
            <View style={styles.filterLabelRow}>
              <Text style={styles.filterLabel}>PARTY</Text>
              <InfoTip text="Narrow the feed to posts from a specific political party. Only parties present in the current time period are shown." />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {parties.map(pk => {
                const colour = party[pk];
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
                      {partyLabel(pk)}
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
                    active && { borderColor: accent.pink, backgroundColor: accent.pink + '20' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.alignChipText, active && { color: accent.pink }]}>{t.label}</Text>
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
          partyKey={selected.post.partyKey}
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
}

/**
 * Minimum dwell to record. Posts mount briefly during list windowing/recycling
 * and during fast scrolls — anything under 500ms is noise, not attention.
 */
const POST_DWELL_MIN_MS = 500;

function PostCard({ post, index, benchmarks, onPress, drag, isActive, compact, activeStyleFilter, activeTopicFilter, onStylePress, onTopicPress, sortKey }: CardProps) {
  const colour = party[post.partyKey];
  const engRate = post.views > 0
    ? +((post.likes + post.comments + post.saves + post.shares) / post.views * 100).toFixed(2)
    : 0;

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
    const partyKey      = post.partyKey;
    const positionInFeed = index;
    const sortKeySnap   = sortKey;

    return () => {
      const dwellMs = Date.now() - startTs;
      if (dwellMs < POST_DWELL_MIN_MS) return;
      track('post_dwell', {
        post_id:          postId,
        politician_name:  politicianName,
        party:            partyKey,
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

  // Generated summary — starts from the BQ value, can be updated live
  const [summary, setSummary]       = useState<string>(post.videoSummary ?? '');
  const [generating, setGenerating] = useState(false);
  const [genSource, setGenSource]   = useState<'video' | 'text' | null>(null);

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const res  = await fetch('/api/summarise', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ postId: post.postId }),
      });
      const data = await res.json() as { summary?: string; source?: 'video' | 'text'; error?: string };
      if (data.summary) {
        setSummary(data.summary);
        setGenSource(data.source ?? null);
      }
    } catch {
      // Failure is surfaced by the button returning to its idle state —
      // no console output, no error detail leaked to the client.
    } finally {
      setGenerating(false);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240, delay: Math.min(index * 22, 440) }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }: any) => [
          compact ? styles.cardCompact : styles.card,
          isActive && styles.cardDragging,
          hovered && { borderColor: colour.base },
          pressed && { opacity: 0.84 },
        ]}
      >
        {/* ── Drag handle — long-press to reorder ─── */}
        {drag && !compact && (
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            style={styles.dragHandle}
            hitSlop={8}
          >
            <Text style={styles.dragIcon}>⠿</Text>
          </Pressable>
        )}

        {/* ── Cover thumbnail ─────────────────────── */}
        <View style={compact ? styles.coverWrapCompact : styles.coverWrap}>
          <ShimmerImage
            uri={post.coverJpeg || undefined}
            wrapStyle={compact ? styles.coverCompact : styles.cover}
            resizeMode="cover"
            accentColour={colour.base}
            fallback={
              <View style={[compact ? styles.coverCompact : styles.cover, styles.coverFallback]}>
                <Text style={styles.coverPlayIcon}>▶</Text>
              </View>
            }
          />
          {/* Party-coloured corner halo — replaces the old left-edge line.
              Radiates from the top-left of the cover so the party identity
              still reads but the card feels lit from within rather than
              ruled into a column. */}
          <LinearGradient
            colors={[`${colour.glow}55`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 0.7 }}
            style={styles.coverHalo}
            pointerEvents="none"
          />
          <View style={styles.viewsBadge}>
            <Text style={styles.viewsNum}>{formatters.compact(post.views)}</Text>
            <Text style={styles.viewsLbl}> views</Text>
          </View>
        </View>

        {/* ── Content column: summary → metrics → info ── */}
        <View style={compact ? styles.rightColCompact : styles.rightCol}>

          {/* 1. AI SUMMARY — most prominent, next to video */}
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryKicker}>AI SUMMARY</Text>
              {genSource ? (
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceTagText}>
                    {genSource === 'video' ? 'from video' : 'from caption'}
                  </Text>
                </View>
              ) : null}
            </View>

            {summary ? (
              <Text style={styles.summaryText}>{summary}</Text>
            ) : generating ? (
              <Text style={styles.summaryEmpty}>Generating summary…</Text>
            ) : (
              <>
                <Text style={styles.summaryEmpty}>
                  No summary yet for this post.
                </Text>
                <Pressable
                  onPress={generateSummary}
                  style={({ pressed }) => [
                    styles.genBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.genBtnText}>✦  Generated by Knox</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.divider} />

          {/* 2. METRICS — large and readable */}
          <View style={styles.metricsRow}>
            <MetricPill value={post.views}    label="Views"    colour={colour.glow} large />
            <MetricPill value={post.likes}    label="Likes"    colour={colour.glow} />
            <MetricPill value={post.comments} label="Comments" colour={colour.glow} />
            <MetricPill value={post.shares}   label="Shares"   colour={colour.glow} />
          </View>

          <View style={styles.divider} />

          {/* 3. BOX-AND-WHISKER DISTRIBUTIONS — side by side to save vertical space */}
          {benchmarks ? (
            <View style={styles.distributionSection}>
              <View style={styles.distHeader}>
                <Text style={styles.distKicker}>HOW THIS POST COMPARES</Text>
                <InfoTip
                  text="These charts show where this post sits against all other posts we track. The coloured box covers the middle 50% of posts. The vertical line is the median. The dot is this post. Hover each part to learn more."
                  width={280}
                />
              </View>
              <View style={styles.distRow}>
                <BoxWhisker
                  label="Views vs dataset"
                  value={post.views}
                  benchmark={benchmarks.views}
                  colour={colour.glow}
                  format={formatters.compact}
                  scaleType="log"
                />
                <View style={styles.distDivider} />
                <BoxWhisker
                  label="Engagement rate"
                  value={engRate}
                  benchmark={benchmarks.engagement}
                  colour={colour.glow}
                  format={v => `${v.toFixed(1)}%`}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* 4. IDENTITY + CAPTION + TAGS — contextual, below the fold */}
          <View style={styles.infoSection}>
            <View style={styles.identityRow}>
              <View style={[styles.partyDotLg, { backgroundColor: colour.base }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.politicianName, { color: colour.glow }]} numberOfLines={1}>
                  {post.politicianName}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>
                  {partyLabel(post.partyKey)}
                  {post.postDate ? ` · ${post.postDate.slice(0, 10)}` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
            <View style={styles.tags}>
              {(post.styles ?? []).map(s => {
                const isActive = activeStyleFilter?.toLowerCase() === s.toLowerCase();
                return (
                  <Pressable
                    key={s}
                    onPress={() => onStylePress?.(s)}
                    style={({ pressed }) => [
                      styles.styleTag,
                      isActive && styles.tagActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{fmtLabel(s)}</Text>
                  </Pressable>
                );
              })}
              {(post.topics ?? []).slice(0, 3).map(t => {
                const isActive = activeTopicFilter?.toLowerCase() === t.toLowerCase();
                return (
                  <Pressable
                    key={t}
                    onPress={() => onTopicPress?.(t)}
                    style={({ pressed }) => [
                      styles.topicTag,
                      isActive && styles.tagActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{fmtLabel(t)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Pressable>
    </MotiView>
  );
}

interface MetricPillProps {
  value:  number;
  label:  string;
  colour: string;
  large?: boolean;
}

function MetricPill({ value, label, colour, large }: MetricPillProps) {
  return (
    <View style={styles.metricPill}>
      <Text style={[styles.metricValue, large && styles.metricValueLg, { color: colour }]}>
        {formatters.compact(value)}
      </Text>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_H  = 480 ;                              // card height = viewport window
const COVER_W = Math.round(CARD_H * (9 / 16));   // 405px — exact 9:16 width for CARD_H
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
  kicker: { ...type.caption, color: neutral.textDim, fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  title: { ...type.title, color: neutral.text, fontSize: 20 },
  titleRange: { ...type.body, color: neutral.textDim, fontSize: 16 },
  countBadge: {
    backgroundColor: accent.pink + '22',
    borderWidth: 1,
    borderColor: accent.pink + '55',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: font.mono,
    fontSize: 12,
    color: accent.pink,
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
    borderColor: accent.pink,
    backgroundColor: 'rgba(255,107,212,0.1)',
  },
  sortChipText: { ...type.caption, color: neutral.textMid, fontSize: 12 },
  sortChipTextActive: { color: accent.pink },

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
    backgroundColor: 'rgba(124,131,255,0.12)',
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
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: CARD_H,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.md,
    marginBottom: GAP,
    overflow: 'hidden',
    backgroundColor: glass.fill,
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
    backgroundColor: 'rgba(124,131,255,0.08)',
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
    backgroundColor: glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },

  // Cover
  coverWrap: {
    width: COVER_W,
    flexShrink: 0,
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  // 9:16 exact — COVER_W = CARD_H * 9/16, so width:height = 9:16 ✓
  cover: {
    width: COVER_W,
    height: CARD_H,
  },
  // Compact cover — 16:9 ratio at full width (shorter than the 9:16 portrait)
  coverWrapCompact: {
    width: '100%' as any,
    aspectRatio: 16 / 9,
    position: 'relative' as const,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  coverCompact: {
    width: '100%' as any,
    height: '100%' as any,
  },
  coverFallback: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlayIcon: { fontSize: 24, color: neutral.textDim },
  // ── Cover halo — replaces the old left-edge party line ───────────────────
  // Soft radial gradient from the top-left corner, party-coloured. Adds
  // identity without the 'sidebar rule' feel of a 3px vertical stripe.
  coverHalo: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
  },
  viewsBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewsNum: {
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  viewsLbl: { fontFamily: font.ui, fontSize: 12, color: neutral.textMid, textTransform: 'none' },

  // Compact right column — full width below cover
  rightColCompact: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },

  // Right column — stacks summary → metrics → distribution → identity vertically
  // Height budget at CARD_H=720px:
  //   metricsRow          ≈  60px  (generous padding)
  //   distributionSection ≈ 148px  (2 plots SIDE-BY-SIDE)
  //   infoSection         ≈ 147px  (generous padding)
  //   dividers × 3        ≈   3px
  //   summarySection      ≈ 362px  (flex:1, ~16 lines)
  rightCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },

  // ── 1. Summary — most prominent, fills remaining height ───────────────────
  summarySection: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  sourceTag: {
    backgroundColor: 'rgba(63,230,177,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(63,230,177,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sourceTagText: {
    fontFamily: font.ui,
    fontSize: 12,
    color: accent.mint,
    textTransform: 'none' as const,
  },
  genBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.45)',
    backgroundColor: 'rgba(124,131,255,0.10)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  genBtnText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: accent.indigo,
    textTransform: 'none' as const,
  },
  summaryText: {
    fontFamily: font.ui,
    color: neutral.text,
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  summaryEmpty: {
    fontFamily: font.ui,
    color: neutral.textDim,
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // ── 2. Metrics — large scannable numbers ─────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  metricPill: { gap: 2 },
  metricValue: {
    fontFamily: font.mono,
    fontSize: 20,
    fontWeight: '700',
  },
  metricValueLg: {
    fontSize: 24,           // views is the headline number
  },
  metricLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },

  // ── 4. Identity + caption + tags — grounding context ────────────────────
  infoSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: glass.border,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  partyDotLg: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  politicianName: {
    fontFamily: font.bold,
    color: neutral.text,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  metaLine: {
    fontFamily: font.ui,
    color: neutral.textDim,
    fontSize: 12,
    textTransform: 'none',
  },
  caption: {
    fontFamily: font.ui,
    color: neutral.textMid,
    fontSize: 12,
    lineHeight: 18,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  styleTag: {
    backgroundColor: 'rgba(124,131,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,131,255,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topicTag: {
    backgroundColor: 'rgba(63,230,177,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63,230,177,0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.bold, fontSize: 12, color: neutral.textMid },
  tagActive: {
    backgroundColor: 'rgba(124,131,255,0.35)',
    borderColor: accent.indigo,
  },
  tagTextActive: { color: accent.indigo },
  tagFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,131,255,0.15)',
    borderWidth: 1,
    borderColor: accent.indigo,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagFilterPillText: { fontFamily: font.bold, fontSize: 12, color: accent.indigo },

  // Box-and-whisker distribution section
  distributionSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  distHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  distKicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  // Two plots rendered side-by-side to save vertical space
  distRow: {
    flexDirection: 'row',
    gap: 0,
  },
  distDivider: {
    width: 1,
    backgroundColor: glass.border,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 72,
    flexShrink: 0,
  },

  // Hairline divider between the sections
  divider: {
    height: 1,
    backgroundColor: glass.border,
  },
});
