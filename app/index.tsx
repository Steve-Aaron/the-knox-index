import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyFindingsBar } from '@/components/dashboard/KeyFindingsBar';
import { PoliticianDetailPanel } from '@/components/dashboard/PoliticianDetailPanel';
import { SummaryPanel } from '@/components/dashboard/SummaryPanel';
import { RankBoard } from '@/components/dashboard/RankBoard';
import { PostsTable } from '@/components/dashboard/PostsTable';
import { LoadingScreen } from '@/components/dashboard/LoadingScreen';
import { TimeRangePicker, TimeRange } from '@/components/dashboard/TimeRangePicker';
import { PartyLeaderboard } from '@/components/dashboard/PartyLeaderboard';
import { StyleBreakdown } from '@/components/dashboard/StyleBreakdown';
import { TopicCloud } from '@/components/dashboard/TopicCloud';
import { ContactFooter } from '@/components/dashboard/ContactFooter';
import { AppFooter } from '@/components/dashboard/AppFooter';
import { StickyUnlock } from '@/components/auth/StickyUnlock';
import { useAuth } from '@/hooks/useAuth';
import { useLiveData } from '@/data/useLiveData';
import { usePostsData } from '@/data/usePostsData';
import { track, startTimer, stopTimer } from '@/lib/analytics';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useBenchmarks } from '@/data/useBenchmarks';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { ErrorBoundary, ErrorScreen } from '@/components/primitives/ErrorBoundary';
import { neutral, glass, accent, party } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import type { ScoreKey } from '@/data/types';

/**
 * Home screen — three-zone layout:
 *   1. Top  : KeyFindingsBar (headline stats strip)
 *   2. Controls: full-width time range + full-width sort chips (stacked)
 *   3. Main : three equal columns on desktop, two on tablet, stacked on mobile
 *              Col A — RankBoard (leaderboard)
 *              Col B — PoliticianDetailPanel
 *              Col C — SummaryPanel (weekly briefing)
 */

const SORTS: { key: ScoreKey; label: string }[] = [
  { key: 'knoxFactor',  label: 'Knox Factor' },
  { key: 'views',       label: 'Views' },
  { key: 'engagement',  label: 'Engagement' },
  { key: 'frequency',   label: 'Frequency' },
  { key: 'followers',   label: 'Followers' },
];

const RANGE_LABELS: Record<TimeRange, string> = {
  yesterday: 'Yesterday',
  week:      'This week',
  month:     'This month',
  year:      'This year',
  lifetime:  'Lifetime',
};

/** Fixed height for the three panels when side-by-side. */
const PANEL_HEIGHT = 620;

function DashboardScreenInner() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= breakpoints.desktop;
  const isTablet  = width >= breakpoints.tablet;
  const isMobile  = width < breakpoints.tablet;
  const hPad = isMobile ? spacing.md : spacing.xl;

  // Area 1: session lifecycle + super properties
  useSessionTracking();

  // Area 9: scroll depth — attach to section root Views
  const sectionRef = useSectionTracking();

  const [range, setRange]       = useState<TimeRange>('week');
  const [sortKey, setSortKey]   = useState<ScoreKey>('knoxFactor');
  const [activeId, setActiveId] = useState<string>('');
  const [scrollY, setScrollY]   = useState(0);

  // Area 4: enhanced sort/range handlers that carry previous values
  const prevSortRef  = useRef<ScoreKey>('knoxFactor');
  const prevRangeRef = useRef<TimeRange>('week');

  const handleSetRange = useCallback((r: TimeRange) => {
    track('time_range_changed', {
      range:          r,
      previous_range: prevRangeRef.current,
    });
    prevRangeRef.current = r;
    setRange(r);
  }, []);

  const handleSetSortKey = useCallback((key: ScoreKey) => {
    track('dashboard_sort_changed', {
      sort_key:          key,
      previous_sort_key: prevSortRef.current,
    });
    prevSortRef.current = key;
    setSortKey(key);
  }, []);

  // Area 3: politician dwell time — emit politician_dwell when the active politician changes
  const activeIdRef        = useRef<string>('');
  const politicianTimerKey = 'politician_dwell';

  const handleSetActiveId = useCallback((id: string) => {
    // Emit dwell for the politician that's leaving
    const previousId = activeIdRef.current;
    if (previousId) {
      track('politician_dwell', {
        politician_id: previousId,
        dwell_ms:      stopTimer(politicianTimerKey),
      });
    }
    // Start the clock for the incoming politician
    if (id) {
      startTimer(politicianTimerKey);
    }
    activeIdRef.current = id;
    setActiveId(id);
    if (id) track('politician_selected', { politician_id: id });
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollY(e.nativeEvent.contentOffset.y);
    },
    []
  );

  const { isRegistered, email: authEmail } = useAuth();
  const { politicians, status, isLive, error, retryAttempt, retryTotal, refresh } = useLiveData();
  const { posts, loading: postsLoading, error: postsError } = usePostsData(range);
  const { benchmarks } = useBenchmarks();

  // Area 10: fire analytics events when data status changes, including recovery timing.
  const prevStatusRef  = useRef(status);
  const errorTimerKey  = 'dashboard_error';
  useEffect(() => {
    if (prevStatusRef.current === status) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'live') {
      track('dashboard_viewed', { account_count: politicians.length });
      // Recovery: was previously in error state
      if (prev === 'error') {
        track('error_recovered', {
          context:            'dashboard',
          time_to_recovery_ms: stopTimer(errorTimerKey),
        });
      }
    } else if (status === 'error') {
      startTimer(errorTimerKey);
      track('error_shown', { context: 'dashboard', message: error ?? 'unknown' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Area 10: posts feed error tracking
  const prevPostsErrorRef = useRef<string | null>(null);
  const postsErrorTimerKey = 'posts_error';
  useEffect(() => {
    const prev = prevPostsErrorRef.current;
    prevPostsErrorRef.current = postsError;

    if (postsError && !prev) {
      startTimer(postsErrorTimerKey);
      track('posts_error_shown', { message: postsError });
    } else if (!postsError && prev) {
      track('posts_error_recovered', {
        time_to_recovery_ms: stopTimer(postsErrorTimerKey),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsError]);

  // Auto-refresh every 5 minutes when live data is available.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const id = setInterval(() => refreshRef.current(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const ranked = useMemo(
    () => [...politicians].sort((a, b) => b.scores[sortKey] - a.scores[sortKey]),
    [politicians, sortKey]
  );

  // active: the explicitly selected politician, or the #1 ranked as default display.
  // activePoliticianName is ONLY non-null when the user has tapped a specific row.
  const selectedPolitician = activeId ? ranked.find(p => p.id === activeId) : undefined;
  const active = selectedPolitician ?? ranked[0];
  const activePoliticianName: string | null = selectedPolitician?.name ?? null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D0D18', '#050509']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={120}
        >

          {/* ── 1. Title bar ──────────────────────────── */}
          <View style={[styles.titleBar, { paddingHorizontal: hPad }]}>
            <View>
              <Text style={styles.kicker}>THE KNOX INDEX · DAILY BRIEF</Text>
              <Text style={styles.title}>Dashboard</Text>
            </View>
            <View style={styles.titleRight}>
              {/* Data source pill */}
              <Pressable onPress={() => { track('retry_tapped'); refresh(); }} style={[
                styles.hint,
                isLive && { borderColor: accent.mint },
                status === 'loading' && { borderColor: accent.amber },
              ]}>
                <LiveDot status={status} isLive={isLive} />
                <Text style={[
                  styles.hintText,
                  isLive && { color: accent.mint },
                  status === 'loading' && { color: accent.amber },
                ]}>
                  {status === 'loading' && retryAttempt > 0
                    ? `Retrying ${retryAttempt}/${retryTotal}…`
                    : status === 'loading'
                    ? 'Loading…'
                    : isLive
                    ? `Live · ${politicians.length} accounts`
                    : 'Error · tap to retry'}
                </Text>
              </Pressable>
              {error ? (
                <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              ) : null}
            </View>
          </View>

          {/* ── 2. Key findings strip ─────────────────── */}
          <View ref={sectionRef('key_findings') as any}>
            <KeyFindingsBar politicians={politicians} />
          </View>

          {/* ── 3. Controls (stacked, full-width each) ── */}
          <View style={[styles.controlsOuter, { paddingHorizontal: hPad }]}>
            {/* Time range — full width */}
            <TimeRangePicker value={range} onChange={handleSetRange} />

            {/* Sort chips — full-width horizontal scroll */}
            <View style={styles.sortWrap}>
              <Text style={styles.sortLabel}>SORT BY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortRow}
              >
                {SORTS.map(s => {
                  const isActive = s.key === sortKey;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => handleSetSortKey(s.key)}
                      style={({ pressed }) => [
                        styles.chip,
                        isActive && styles.chipActive,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text
                        style={[styles.chipText, isActive && styles.chipTextActive]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* ── 4. Three-column main area ─────────────── */}
          {status === 'loading' && politicians.length === 0 ? (
            // Skeleton shown before first data arrives
            <View style={[styles.threeCol, { paddingHorizontal: spacing.xl }]}>
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
            </View>
          ) : status === 'error' && politicians.length === 0 ? (
            // Hard error — BigQuery unreachable or bad response
            <View style={{ paddingHorizontal: spacing.xl }}>
              <ErrorScreen message={error ?? undefined} onRetry={refresh} />
            </View>
          ) : isDesktop ? (
            // Desktop: three equal columns side-by-side
            <View style={[styles.threeCol, { paddingHorizontal: hPad }]}>
              <View style={styles.col}>
                <RankBoard
                  politicians={politicians}
                  activeId={activeId}
                  headlineKey={sortKey}
                  timeRangeLabel={RANGE_LABELS[range]}
                  onSelect={handleSetActiveId}
                  panelHeight={PANEL_HEIGHT}
                  isRegistered={isRegistered}
                />
              </View>
              <View style={styles.col}>
                {active
                  ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} panelHeight={PANEL_HEIGHT} />
                  : <SkeletonBlock height={PANEL_HEIGHT} style={{ borderRadius: 22 }} />}
              </View>
              <View style={styles.col}>
                <SummaryPanel politicians={politicians} panelHeight={PANEL_HEIGHT} />
              </View>
            </View>
          ) : isTablet ? (
            <View style={[styles.stackedTablet, { paddingHorizontal: hPad }]}>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <RankBoard
                    politicians={politicians}
                    activeId={activeId}
                    headlineKey={sortKey}
                    timeRangeLabel={RANGE_LABELS[range]}
                    onSelect={handleSetActiveId}
                    panelHeight={PANEL_HEIGHT}
                    isRegistered={isRegistered}
                  />
                </View>
                <View style={styles.col}>
                  {active
                    ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} panelHeight={PANEL_HEIGHT} />
                    : <SkeletonBlock height={PANEL_HEIGHT} style={{ borderRadius: 22 }} />}
                </View>
              </View>
              <SummaryPanel politicians={politicians} />
            </View>
          ) : (
            <View style={[styles.mobileStack, { paddingHorizontal: hPad }]}>
              <RankBoard
                politicians={politicians}
                activeId={activeId}
                headlineKey={sortKey}
                timeRangeLabel={RANGE_LABELS[range]}
                onSelect={handleSetActiveId}
                isRegistered={isRegistered}
              />
              {active
                ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} />
                : <SkeletonBlock height={400} style={{ borderRadius: 22 }} />}
              <SummaryPanel politicians={politicians} />
            </View>
          )}

          {/* ── 5. Party league ───────────────────────── */}
          <View
            ref={sectionRef('party_leaderboard') as any}
            style={[styles.partySection, { paddingHorizontal: hPad }]}
          >
            <PartyLeaderboard politicians={politicians} />
          </View>

          {/* ── 6. Posts table ────────────────────────── */}
          <View
            ref={sectionRef('post_feed') as any}
            style={[styles.postsSection, { paddingHorizontal: hPad }]}
          >
            <ErrorBoundary>
              <PostsTable
                posts={posts}
                loading={postsLoading}
                rangeLabel={RANGE_LABELS[range]}
                activePoliticianName={activePoliticianName}
                onClearPolitician={() => handleSetActiveId('')}
                benchmarks={benchmarks ?? undefined}
              />
            </ErrorBoundary>
          </View>

          {/* ── 7. Style + topics row ─────────────────── */}
          <View
            ref={sectionRef('style_breakdown') as any}
            style={[styles.insightsRow, { paddingHorizontal: hPad }, isDesktop ? styles.insightsRowDesktop : styles.insightsRowStacked]}
          >
            <View style={styles.insightsCol}>
              <StyleBreakdown posts={posts} rangeLabel={RANGE_LABELS[range]} />
            </View>
            <View style={styles.insightsCol}>
              <TopicCloud posts={posts} rangeLabel={RANGE_LABELS[range]} />
            </View>
          </View>

          {/* ── 8. Contact footer ─────────────────────── */}
          <View
            ref={sectionRef('contact_footer') as any}
            style={[styles.contactSection, { paddingHorizontal: hPad }]}
          >
            <ContactFooter />
          </View>

          {/* ── 9. App footer ─────────────────────────── */}
          <View style={[styles.footerSection, { paddingHorizontal: hPad }]}>
            <AppFooter />
          </View>

        </ScrollView>
        {/* Sticky registration CTA — appears after scrolling, hidden once registered */}
        <StickyUnlock scrollY={scrollY} isRegistered={isRegistered} email={authEmail} />
      </SafeAreaView>

      {/* Loading screen — absolute overlay, fades out once BQ data arrives.
          Gemini brief and other async data load independently afterwards. */}
      <LoadingScreen visible={status === 'loading' && politicians.length === 0} />
    </View>
  );
}

export default function DashboardScreen() {
  return (
    <ErrorBoundary>
      <DashboardScreenInner />
    </ErrorBoundary>
  );
}

// ── LiveDot ────────────────────────────────────────────────────────────────────
// Animated status indicator. Pulses a ring when live; spins amber when loading.

interface LiveDotProps {
  status: string;
  isLive: boolean;
}

function LiveDot({ status, isLive }: LiveDotProps) {
  const isLoading = status === 'loading';
  const dotColor  = isLoading ? accent.amber : isLive ? accent.mint : neutral.textDim;
  const pulseColor = isLoading ? accent.amber : accent.mint;
  const shouldPulse = isLive || isLoading;

  return (
    <View style={dotStyles.wrap}>
      {/* Ripple ring — only when active */}
      {shouldPulse && (
        <MotiView
          from={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 2.8 }}
          transition={{
            type: 'timing',
            duration: 1400,
            loop: true,
            repeatReverse: false,
          }}
          style={[
            dotStyles.ring,
            { borderColor: pulseColor },
          ]}
        />
      )}
      {/* Core dot */}
      <View style={[dotStyles.dot, { backgroundColor: dotColor }]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  wrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// ── Screen styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral.felt,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,        // 12px between sections — tight dashboard rhythm
  },

  // Title bar
  titleBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
  },
  title: {
    ...type.title,
    color: neutral.text,
    marginTop: 2,
  },
  titleRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {},
    }),
  },
  hintText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 10,
  },
  errorText: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 9,
    maxWidth: 260,
  },

  // Controls
  controlsOuter: {
    gap: spacing.md,
  },
  sortWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sortLabel: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 10,
    flexShrink: 0,
  },
  sortRow: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexShrink: 0,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color, background-color',
        transitionDuration: '160ms',
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },
  chipActive: {
    borderColor: accent.indigo,
    backgroundColor: 'rgba(124,131,255,0.12)',
  },
  chipText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 11,
    // no-wrap enforced via numberOfLines={1} on the Text element
  },
  chipTextActive: {
    color: accent.indigo,
  },

  // Layout containers
  threeCol: {
    flexDirection: 'row',
    gap: spacing.base,
    height: PANEL_HEIGHT,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.base,
    height: PANEL_HEIGHT,
  },
  col: {
    flex: 1,
  },
  stackedTablet: {
    gap: spacing.md,
  },
  mobileStack: {
    gap: spacing.md,
  },
  postsSection: {
    marginTop: spacing.xl,
  },
  partySection: {
    marginTop: spacing.xl,
  },
  insightsRow: {
    marginTop: spacing.xl,
    gap: spacing.base,
  },
  insightsRowDesktop: {
    flexDirection: 'row',
  },
  insightsRowStacked: {
    flexDirection: 'column',
  },
  insightsCol: {
    flex: 1,
  },
  contactSection: {
    marginTop: spacing.xl,
  },
  footerSection: {
    marginTop: spacing.xxl,
  },
});
