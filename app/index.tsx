import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PoliticianDetailPanel } from '@/components/dashboard/PoliticianDetailPanel';
import { SummaryPanel } from '@/components/dashboard/SummaryPanel';
import { RankBoard } from '@/components/dashboard/RankBoard';
import { PostsTable } from '@/components/dashboard/PostsTable';
import { MobileSection } from '@/components/primitives/MobileSection';
import { LoadingScreen } from '@/components/dashboard/LoadingScreen';
import { TimeRangePicker, TimeRange } from '@/components/dashboard/TimeRangePicker';
import { PartyLeaderboard } from '@/components/dashboard/PartyLeaderboard';
import { AccountsInterstitial } from '@/components/dashboard/AccountsInterstitial';
import { StyleBreakdown } from '@/components/dashboard/StyleBreakdown';
import { TopicCloud } from '@/components/dashboard/TopicCloud';
import { ContactFooter } from '@/components/dashboard/ContactFooter';
import { AppFooter } from '@/components/dashboard/AppFooter';
import { StickyUnlock } from '@/components/auth/StickyUnlock';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { SquareButton } from '@/components/primitives/SquareButton';
import { HomeHero } from '@/components/dashboard/HomeHero';
import { Interstitial } from '@/components/primitives/Interstitial';
import { DevPanel } from '@/components/primitives/DevPanel';
import { getDevPreview, setDevPreview, type DevPreviewState } from '@/lib/devPreview';
import { useAuth } from '@/hooks/useAuth';
import { useLiveData } from '@/data/useLiveData';
import { usePostsData, type PostsSortKey } from '@/data/usePostsData';
import { track, startTimer, stopTimer } from '@/lib/analytics';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useBenchmarks } from '@/data/useBenchmarks';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { ErrorBoundary, ErrorScreen } from '@/components/primitives/ErrorBoundary';
import { Kicker } from '@/components/ui/Kicker';
import { Title } from '@/components/ui/Title';
import { neutral, glass, accent, party, brand } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import type { LeaderboardSortKey } from '@/data/types';
import { leaderboardScore, viralityRatioFor, engagementRate } from '@/data/leaderboard';
import type { PartyKey } from '@/theme/colors';

/**
 * Home screen — three-zone layout:
 *   1. Top  : KeyFindingsBar (headline stats strip)
 *   2. Controls: full-width time range + full-width sort chips (stacked)
 *   3. Main : three equal columns on desktop, two on tablet, stacked on mobile
 *              Col A — RankBoard (leaderboard)
 *              Col B — PoliticianDetailPanel
 *              Col C — SummaryPanel (weekly briefing)
 */

const SORTS: { key: LeaderboardSortKey; label: string }[] = [
  { key: 'knoxFactor',  label: 'Knox Factor' },
  { key: 'views',       label: 'Views' },
  { key: 'engagement',  label: 'Engagement' },
  { key: 'frequency',   label: 'Frequency' },
  { key: 'followers',   label: 'Followers' },
  { key: 'virality',    label: 'Virality' },
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

  // Logged-in users start on 'This Year' from the first render so there's no
  // Yesterday→Year fetch flip. We read the persisted login flag (the same one
  // useAuth maintains) synchronously here. SSR-safe: the server has no
  // localStorage, so it falls back to 'yesterday' and the effect below still
  // upgrades the range once auth confirms (covers fresh logins this session).
  const [range, setRange]           = useState<TimeRange>(() => {
    if (typeof localStorage !== 'undefined') {
      try { if (localStorage.getItem('tki_registered') === '1') return 'year'; } catch { /* ignore */ }
    }
    return 'yesterday';
  });
  const [sortKey, setSortKey]       = useState<LeaderboardSortKey>('knoxFactor');
  const [activeId, setActiveId]     = useState<string>('');
  const [showAccounts, setShowAccounts] = useState(false);
  const [partyFilter, setPartyFilter] = useState<PartyKey | null>(null);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const postsSectionRef = useRef<View>(null);

  // Locked time-range interstitial — set to the attempted range when an
  // unregistered user taps This Month / This Year / Lifetime.
  const [lockedRangeAttempt, setLockedRangeAttempt] = useState<TimeRange | null>(null);

  // Sticky 'Register' bar should only appear AFTER the user has scrolled past
  // the hero. Otherwise it competes with the in-hero NewsletterForm.
  const [pastHero, setPastHero] = useState(false);
  // Hero entrance animations gate is declared further down once `status` and
  // `isInitialLoad` from useLiveData are in scope.
  const [heroReady, setHeroReady] = useState(false);
  const handleHeroScroll = useCallback((e: any) => {
    const y      = e?.nativeEvent?.contentOffset?.y ?? 0;
    const winH   = e?.nativeEvent?.layoutMeasurement?.height ?? 0;
    // 80% of viewport — gives a bit of overshoot before the bar pops up
    const thresh = winH > 0 ? winH * 0.8 : 600;
    if (y > thresh && !pastHero)      setPastHero(true);
    else if (y <= thresh && pastHero) setPastHero(false);
  }, [pastHero]);

  // Selecting a style from the Style League below the feed should bring the
  // filtered feed into view — otherwise the user has no signal the filter took.
  const handleStyleSelect = useCallback((s: string | null) => {
    setStyleFilter(s);
    if (s && postsSectionRef.current) {
      // measure() gives us the y of the posts section relative to its parent
      // ScrollView, then we scroll to it with a slight offset for breathing room.
      const sv: any = scrollViewRef.current;
      const innerNode = sv?.getInnerViewNode?.() ?? sv;
      postsSectionRef.current.measureLayout(
        innerNode,
        (_x, y) => scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
        () => {/* measure failed — silently ignore */},
      );
    }
  }, []);

  // Tapping a row in the PartyLeaderboard widget also changes the post feed's
  // party filter via shared parent state. Fire `party_filter_changed` here so
  // the analytics event tracks every filter state change regardless of which
  // UI surface triggered it. The leaderboard-specific event
  // `party_leaderboard_row_tapped` is still fired separately from inside
  // PartyLeaderboard itself — the two events measure different intents and
  // both are useful.
  const handlePartyLeaderboardSelect = useCallback((pk: PartyKey | null) => {
    track('party_filter_changed', {
      party:  pk ?? 'all',
      source: 'leaderboard',
    });
    setPartyFilter(pk);
  }, []);

  // Area 4: enhanced sort/range handlers that carry previous values
  const prevSortRef  = useRef<LeaderboardSortKey>('knoxFactor');
  const prevRangeRef = useRef<TimeRange>('yesterday');
  // Tracks whether the user has chosen a range themselves, and whether the
  // logged-in default ('This Year') has already been applied — so the auto
  // switch fires at most once and never overrides a manual choice.
  const userChangedRangeRef = useRef(false);
  const autoYearAppliedRef  = useRef(false);

  const handleSetRange = useCallback((r: TimeRange) => {
    track('time_range_changed', {
      range:          r,
      previous_range: prevRangeRef.current,
    });
    userChangedRangeRef.current = true;
    prevRangeRef.current = r;
    setRange(r);
  }, []);

  const handleSetSortKey = useCallback((key: LeaderboardSortKey) => {
    track('dashboard_sort_changed', {
      sort_key:          key,
      previous_sort_key: prevSortRef.current,
    });
    prevSortRef.current = key;
    setSortKey(key);
  }, []);

  // Area 3: politician dwell time — emit politician_dwell when the active politician changes.
  // rankedRef + sortKeyRef give the callback stable identity while always reading the
  // latest values — avoids a forward-reference problem since `ranked` is declared later.
  const activeIdRef        = useRef<string>('');
  const politicianTimerKey = 'politician_dwell';
  const rankedRef          = useRef<typeof ranked>([] as any);
  const sortKeyRef         = useRef<LeaderboardSortKey>(sortKey);

  const handleSetActiveId = useCallback((id: string) => {
    // Emit dwell for the politician that's leaving, enriched with name + party
    const previousId = activeIdRef.current;
    if (previousId) {
      const prev = rankedRef.current.find(p => p.id === previousId);
      track('politician_dwell', {
        politician_id:   previousId,
        politician_name: prev?.name      ?? null,
        party_key:       prev?.partyKey  ?? null,
        dwell_ms:        stopTimer(politicianTimerKey),
      });
    }
    // Start the clock for the incoming politician
    if (id) {
      startTimer(politicianTimerKey);
    }
    activeIdRef.current = id;
    setActiveId(id);
    if (id) {
      const p    = rankedRef.current.find(pol => pol.id === id);
      const rank = p ? rankedRef.current.indexOf(p) + 1 : null;
      track('politician_selected', {
        politician_id:   id,
        politician_name: p?.name      ?? null,
        party_key:       p?.partyKey  ?? null,
        party_label:     p?.partyLabel ?? null,
        rank,
        sort_key:        sortKeyRef.current,
      });
    }
  // Stable callback — reads latest values via refs, no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug URL param: ?debug=full | signup | gate | off
  // Strip the param BEFORE calling setDevPreview so the subsequent
  // window.location.reload() hits the clean URL and doesn't loop.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof __DEV__ === 'undefined' || !__DEV__) return;
    const params = new URLSearchParams(window.location.search);
    const raw    = params.get('debug');
    if (!raw) return;
    const VALID: DevPreviewState[] = ['off', 'gate', 'signup', 'full'];
    if (!VALID.includes(raw as DevPreviewState)) return;
    // Strip the param first — reload will then land on the clean URL
    params.delete('debug');
    const cleanSearch = params.toString();
    const cleanUrl    = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    history.replaceState(null, '', cleanUrl);
    setDevPreview(raw as DevPreviewState);
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isRegistered, email: authEmail } = useAuth();

  // Logged-in users land on 'This Year' instead of Yesterday. Fires once, when
  // the session is confirmed (on load or on fresh login this session), and only
  // if the user hasn't already picked a range themselves.
  useEffect(() => {
    if (isRegistered && !userChangedRangeRef.current && !autoYearAppliedRef.current) {
      autoYearAppliedRef.current = true;
      prevRangeRef.current = 'year';
      setRange('year');
    }
  }, [isRegistered]);

  // Post feed sort is lifted here so it can drive the API's ORDER BY (the
  // server returns the top-N for whichever metric is selected). When the user
  // changes sort in the PostsTable, a new fetch fires and the feed refreshes.
  const [postsSortKey, setPostsSortKey] = useState<PostsSortKey>('views');

  const { politicians, totalPostsInDb, totalViewsInDb, topPost, status, isLive, error, retryAttempt, retryTotal, isInitialLoad, refresh } = useLiveData(range);
  const { posts, loading: postsLoading, loadingMore: postsLoadingMore, hasMore: postsHasMore, error: postsError, loadMore: loadMorePosts } = usePostsData(range, postsSortKey);
  const { benchmarks } = useBenchmarks();

  // Hero entrance animations are gated until the LoadingScreen has fully
  // faded out — otherwise the headline 'folds in' under the loading
  // overlay and the user never sees the animation. LoadingScreen's exit
  // fade is 600ms (see components/dashboard/LoadingScreen.tsx); we wait
  // a little longer to ensure it's gone before the hero plays.
  const loadingDone = !isInitialLoad || status !== 'loading';
  useEffect(() => {
    if (!loadingDone || heroReady) return;
    const t = setTimeout(() => setHeroReady(true), 650);
    return () => clearTimeout(t);
  }, [loadingDone, heroReady]);

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
    () => [...politicians]
      .filter(p => p.totals.postsInRange > 0)
      .sort((a, b) => {
        const lt = range === 'lifetime';
        const d = leaderboardScore(b, sortKey, lt) - leaderboardScore(a, sortKey, lt);
        if (d !== 0) return d;
        if (sortKey === 'virality') return viralityRatioFor(b, lt) - viralityRatioFor(a, lt);
        // Followers tie-break: higher raw follower count always ranks above lower.
        if (sortKey === 'followers') return b.totals.followers - a.totals.followers;
        return 0;
      }),
    [politicians, sortKey, range]
  );
  // Engagement display reference (%): the top engagement rate in the current
  // range's loaded set, capped at 15%. Drives the radar + leaderboard engagement
  // display scaling (display only — never the Knox Factor).
  const engReference = useMemo(() => {
    let m = 0;
    for (const p of ranked) { const r = engagementRate(p); if (r > m) m = r; }
    return Math.min(m, 15);
  }, [ranked]);

  // Keep refs in sync so handleSetActiveId always reads current values.
  rankedRef.current   = ranked;
  sortKeyRef.current  = sortKey;

  // active: the explicitly selected politician, or the #1 ranked as default display.
  // activePoliticianName is ONLY non-null when the user has tapped a specific row.
  const selectedPolitician = activeId ? ranked.find(p => p.id === activeId) : undefined;
  const active = selectedPolitician ?? ranked[0];
  const activePoliticianName: string | null = selectedPolitician?.name ?? null;

  return (
    <View style={styles.root}>
      {/* Knox product gradient — dark for the top 75%, eases to the lighter
          horizon tone at the very bottom. Stops live in theme/colors.ts. */}
      <LinearGradient
        colors={brand.productGradient as unknown as [string, string, string]}
        locations={brand.productGradientLocations as unknown as [number, number, number]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Persistent top nav — logo, signup, contact (TODO), privacy */}
        <HeaderNav activeRoute="/" />

        {/* <main> wrapper — RN Web maps role="main" to a real <main> HTML tag.
            RN's TS types don't include 'main' so we cast through unknown. */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          accessibilityRole={'main' as unknown as 'menu'}
          onScroll={handleHeroScroll}
          scrollEventThrottle={32}
        >

          {/* ── 0. Hero — editorial 100vh layout, includes KeyFindings strip ──── */}
          <HomeHero politicians={politicians} range={range} totalPostsInDb={totalPostsInDb} totalViewsInDb={totalViewsInDb} topPost={topPost} ready={heroReady} />

          {/* ── 1. Title bar ──────────────────────────── */}
          <MobileSection index={0}>
          <View
            style={[styles.titleBar, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_title_bar' } as any : {})}
          >
            <View>
              <Kicker tone='dim'>THE KNOX INDEX · DAILY BRIEF</Kicker>
              <Title style={{ marginTop: 2 }}>Dashboard</Title>
            </View>
            <View style={styles.titleRight}>
              {/* Square button — opens AccountsInterstitial; fills bottom-to-top on hover.
                  Hidden on mobile to keep the title bar uncluttered on narrow screens. */}
              {!isMobile && (
                <SquareButton
                  label={
                    status === 'loading' && retryAttempt > 0
                      ? `Retrying ${retryAttempt}/${retryTotal}…`
                      : status === 'loading'
                      ? 'Loading…'
                      : status === 'error'
                      ? 'Error — tap to retry'
                      : 'See all TikTok accounts'
                  }
                  variant="live"
                  leading={<LiveDot status={status} isLive={isLive} />}
                  onPress={() => { track('accounts_pill_tapped'); setShowAccounts(true); }}
                />
              )}
              {error ? (
                <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              ) : null}
            </View>
          </View>
          </MobileSection>

          {/* ── 2. Key findings strip ─────────────────────────────────────
              KeyFindingsBar lives inside <HomeHero /> so the numbers
              land above the fold. The ref is kept here as an empty
              anchor so scroll-depth analytics still fire when the user
              scrolls past the hero. */}
          <View
            ref={sectionRef('key_findings') as any}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_key_findings_bar' } as any : {})}
          />

          {/* ── 3. Controls (stacked, full-width each) ── */}
          <MobileSection index={1}>
          <View
            style={[styles.controlsOuter, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_controls_time_sort' } as any : {})}
          >
            {/* Time range — full width */}
            <TimeRangePicker
              value={range}
              onChange={handleSetRange}
              isRegistered={isRegistered}
              onLockedTap={(r) => {
                track('locked_range_tapped', { range: r });
                setLockedRangeAttempt(r);
              }}
            />

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
          </MobileSection>

          {/* ── 4. Three-column main area ─────────────── */}
          <MobileSection index={2}>
          {status === 'loading' && politicians.length === 0 ? (
            // Skeleton shown before first data arrives
            <View style={[styles.threeCol, { paddingHorizontal: hPad }]}>
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
              <SkeletonBlock height={PANEL_HEIGHT} style={{ flex: 1, borderRadius: 22 }} />
            </View>
          ) : status === 'error' && politicians.length === 0 ? (
            // Hard error — BigQuery unreachable or bad response
            <View style={{ paddingHorizontal: hPad }}>
              <ErrorScreen message={error ?? undefined} onRetry={refresh} />
            </View>
          ) : isDesktop ? (
            // Desktop: three equal columns side-by-side, aligned with other sections
            <View
              style={[styles.threeCol, { paddingHorizontal: hPad }]}
              {...(Platform.OS === 'web' ? { 'data-container_name': 'row_three_col_desktop' } as any : {})}
            >
              <View
                style={styles.col}
                {...(Platform.OS === 'web' ? { 'data-container_name': 'card_rank_board_col' } as any : {})}
              >
                <RankBoard
                  politicians={politicians}
                  activeId={activeId}
                  headlineKey={sortKey}
                  timeRangeLabel={RANGE_LABELS[range]}
                  onSelect={handleSetActiveId}
                  panelHeight={PANEL_HEIGHT}
                  isRegistered={isRegistered}
                  isLifetime={range === 'lifetime'}
                  engReference={engReference}
                />
              </View>
              <View
                style={styles.col}
                {...(Platform.OS === 'web' ? { 'data-container_name': 'card_politician_detail_col' } as any : {})}
              >
                {active
                  ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} range={range} engReference={engReference} panelHeight={PANEL_HEIGHT} />
                  : <SkeletonBlock height={PANEL_HEIGHT} style={{ borderRadius: 22 }} />}
              </View>
              <View
                style={styles.col}
                {...(Platform.OS === 'web' ? { 'data-container_name': 'card_summary_panel_col' } as any : {})}
              >
                <SummaryPanel politicians={politicians} range={range} panelHeight={PANEL_HEIGHT} />
              </View>
            </View>
          ) : isTablet ? (
            <View
              style={[styles.stackedTablet, { paddingHorizontal: hPad }]}
              {...(Platform.OS === 'web' ? { 'data-container_name': 'row_stacked_tablet' } as any : {})}
            >
              <View
                style={styles.twoCol}
                {...(Platform.OS === 'web' ? { 'data-container_name': 'row_two_col_tablet' } as any : {})}
              >
                <View
                  style={styles.col}
                  {...(Platform.OS === 'web' ? { 'data-container_name': 'card_rank_board_col' } as any : {})}
                >
                  <RankBoard
                    politicians={politicians}
                    activeId={activeId}
                    headlineKey={sortKey}
                    timeRangeLabel={RANGE_LABELS[range]}
                    onSelect={handleSetActiveId}
                    panelHeight={PANEL_HEIGHT}
                    isRegistered={isRegistered}
                    isLifetime={range === 'lifetime'}
                  engReference={engReference}
                  />
                </View>
                <View
                  style={styles.col}
                  {...(Platform.OS === 'web' ? { 'data-container_name': 'card_politician_detail_col' } as any : {})}
                >
                  {active
                    ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} range={range} engReference={engReference} panelHeight={PANEL_HEIGHT} />
                    : <SkeletonBlock height={PANEL_HEIGHT} style={{ borderRadius: 22 }} />}
                </View>
              </View>
              <SummaryPanel politicians={politicians} range={range} />
            </View>
          ) : (
            <View
              style={[styles.mobileStack, { paddingHorizontal: hPad }]}
              {...(Platform.OS === 'web' ? { 'data-container_name': 'row_mobile_stack' } as any : {})}
            >
              <RankBoard
                politicians={politicians}
                activeId={activeId}
                headlineKey={sortKey}
                timeRangeLabel={RANGE_LABELS[range]}
                onSelect={handleSetActiveId}
                isRegistered={isRegistered}
                isLifetime={range === 'lifetime'}
                engReference={engReference}
              />
              {active
                ? <PoliticianDetailPanel politician={active} headlineKey={sortKey} range={range} engReference={engReference} />
                : <SkeletonBlock height={400} style={{ borderRadius: 22 }} />}
              <SummaryPanel politicians={politicians} range={range} />
            </View>
          )}
          </MobileSection>

          {/* ── 5. Party league ───────────────────────── */}
          <MobileSection index={3}>
          <View
            ref={sectionRef('party_leaderboard') as any}
            style={[styles.partySection, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_party_leaderboard' } as any : {})}
          >
            <PartyLeaderboard
              politicians={politicians}
              range={range}
              activeParty={partyFilter}
              onPartySelect={handlePartyLeaderboardSelect}
            />
          </View>
          </MobileSection>

          {/* ── 6. Posts table ────────────────────────── */}
          <MobileSection index={4}>
          <View
            ref={(node: any) => {
              // Compose two refs: one for section-scroll analytics, one for measure-scroll.
              (sectionRef('post_feed') as any)(node);
              (postsSectionRef as any).current = node;
            }}
            style={[styles.postsSection, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_posts_table' } as any : {})}
          >
            <ErrorBoundary>
              <PostsTable
                posts={posts}
                loading={postsLoading}
                rangeLabel={RANGE_LABELS[range]}
                activePoliticianName={activePoliticianName}
                onClearPolitician={() => handleSetActiveId('')}
                benchmarks={benchmarks ?? undefined}
                isRegistered={isRegistered}
                externalPartyFilter={partyFilter}
                onPartyFilterChange={setPartyFilter}
                externalStyleFilter={styleFilter}
                onStyleFilterChange={setStyleFilter}
                externalSortKey={postsSortKey}
                onSortKeyChange={setPostsSortKey}
                hasMore={postsHasMore}
                loadingMore={postsLoadingMore}
                onLoadMore={loadMorePosts}
              />
            </ErrorBoundary>
          </View>
          </MobileSection>

          {/* ── 7. Style + topics row ─────────────────── */}
          <MobileSection index={5}>
          <View
            ref={sectionRef('style_breakdown') as any}
            style={[styles.insightsRow, { paddingHorizontal: hPad }, isDesktop ? styles.insightsRowDesktop : styles.insightsRowStacked]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_style_topics_insights' } as any : {})}
          >
            <View style={styles.insightsCol}>
              <StyleBreakdown
                posts={posts}
                rangeLabel={RANGE_LABELS[range]}
                activeStyle={styleFilter}
                onStyleSelect={handleStyleSelect}
              />
            </View>
            <View style={styles.insightsCol}>
              <TopicCloud posts={posts} rangeLabel={RANGE_LABELS[range]} />
            </View>
          </View>
          </MobileSection>

          {/* ── 8. Contact footer ─────────────────────── */}
          <MobileSection index={6}>
          <View
            ref={sectionRef('contact_footer') as any}
            style={[styles.contactSection, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_contact_footer' } as any : {})}
          >
            <ContactFooter />
          </View>
          </MobileSection>

          {/* ── 9. App footer ─────────────────────────── */}
          <MobileSection index={7}>
          <View
            style={[styles.footerSection, { paddingHorizontal: hPad }]}
            {...(Platform.OS === 'web' ? { 'data-container_name': 'row_app_footer' } as any : {})}
          >
            <AppFooter />
          </View>
          </MobileSection>

        </ScrollView>
        {/* Sticky registration CTA — visible immediately for unregistered users */}
        <StickyUnlock showBar={pastHero && !isRegistered} isRegistered={isRegistered} email={authEmail} />
      </SafeAreaView>

      {/* Dev-only preview panel — stripped from production builds */}
      <DevPanel />

      {/* Loading screen — absolute overlay, fades out once BQ data arrives.
          Gemini brief and other async data load independently afterwards. */}
      <LoadingScreen visible={isInitialLoad && status === 'loading'} />

      {/* Accounts interstitial — shown when the Live pill is tapped */}
      {showAccounts && (
        <AccountsInterstitial
          politicians={politicians}
          onClose={() => setShowAccounts(false)}
          onRefresh={refresh}
        />
      )}

      {/* Locked time-range interstitial — unregistered users see this when
          they tap This Month / This Year / Lifetime. */}
      <Interstitial
        visible={lockedRangeAttempt != null}
        onClose={() => setLockedRangeAttempt(null)}
        kicker="REGISTER TO UNLOCK"
        title={
          lockedRangeAttempt
            ? `The full ${RANGE_LABELS[lockedRangeAttempt].toLowerCase()} view is for registered users.`
            : ''
        }
        text="Free, takes 30 seconds. Magic link sent to your inbox - no password. You'll see every tracked post across this time range, plus party-level filters, virality scoring and CSV export."
        ctaLabel="Register free"
        onCta={() => {
          track('locked_range_register_cta', { range: lockedRangeAttempt ?? 'unknown' });
          setLockedRangeAttempt(null);
          // Scroll back to the hero — the NewsletterForm is there
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }}
        secondaryLabel="Maybe later"
      />
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
  scrollView: {
    paddingHorizontal: spacing.base,  // 1rem gutters — remains scrollable on web
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
    fontSize: 12,
  },
  errorText: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
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
    fontSize: 12,
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
    backgroundColor: 'rgba(95,100,189,0.12)',
  },
  chipText: {
    ...type.caption,
    color: neutral.textMid,
    fontSize: 12,
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
    alignItems:   'stretch',
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
