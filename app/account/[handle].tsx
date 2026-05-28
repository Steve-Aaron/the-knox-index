import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AccountHero } from '@/components/account/AccountHero';
import { ScoreCard } from '@/components/account/ScoreCard';
import { AccountPostCard } from '@/components/account/AccountPostCard';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { DevPanel } from '@/components/primitives/DevPanel';
import { HeaderNav } from '@/components/primitives/HeaderNav';
import { neutral, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import type { AccountPageResponse, ScoreKey } from '@/data/types';

/**
 * Account page — /account/[handle]
 * ----------------------------------
 * Dynamically rendered per TikTok handle.
 * Three sections: hero + radar, per-metric scorecards, post feed.
 * One job: surface the full profile for one account.
 */

// One accent colour per metric — consistent across cards.
const METRIC_COLORS: Record<ScoreKey, string> = {
  knoxFactor:  accent.indigo,
  views:       accent.amber,
  engagement:  accent.pink,
  frequency:   accent.mint,
  followers:   '#A78BFA',   // soft purple
};

const SCORE_ORDER: ScoreKey[] = ['knoxFactor', 'views', 'engagement', 'frequency', 'followers'];

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.text}>{title}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  text:  { fontFamily: font.bold, fontSize: 10, color: neutral.textDim, letterSpacing: 1.8 },
  line:  { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
});

function LoadingSkeleton() {
  return (
    <View style={{ gap: spacing.lg, padding: spacing.xl }}>
      <SkeletonBlock height={320} borderRadius={16} />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {[0, 1, 2].map(i => <SkeletonBlock key={i} height={260} borderRadius={16} style={{ flex: 1 }} />)}
      </View>
      {[0, 1, 2].map(i => <SkeletonBlock key={i} height={160} borderRadius={16} />)}
    </View>
  );
}

function NotFound({ handle }: { handle: string }) {
  return (
    <View style={notFoundStyles.wrap}>
      <Text style={notFoundStyles.emoji}>404</Text>
      <Text style={notFoundStyles.title}>Account not found</Text>
      <Text style={notFoundStyles.sub}>No account exists for @{handle}</Text>
    </View>
  );
}

const notFoundStyles = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emoji: { fontFamily: font.bold, fontSize: 48, color: neutral.textDim },
  title: { fontFamily: font.bold, fontSize: 22, color: neutral.text },
  sub:   { ...type.body, color: neutral.textDim, fontSize: 14 },
});

export default function AccountPage() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { width }  = useWindowDimensions();
  const isDesktop  = width >= breakpoints.desktop;
  const isTablet   = width >= breakpoints.tablet;

  const [data,    setData]    = useState<AccountPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setError(null);
    setPage(1);

    fetch(`/api/account?handle=${encodeURIComponent(handle)}&range=week`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<AccountPageResponse>;
      })
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load account'))
      .finally(() => setLoading(false));
  }, [handle]);

  const hPad = isTablet ? spacing.xl : spacing.md;

  return (
    <View style={styles.root}>
      {/* Knox product gradient — dark for the top 75%, horizon glow at the foot */}
      <LinearGradient
        colors={['#1F1D1D', '#1F1D1D', '#35393B']}
        locations={[0, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <HeaderNav />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingHorizontal: hPad }]}
        >
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <NotFound handle={handle ?? ''} />
          ) : data ? (
            <>
              {/* ── SECTION 1: Hero + Radar ─────────────── */}
              <View style={styles.section}>
                <AccountHero
                  politician={data.politician}
                  overallRank={data.overallRank}
                  totalCount={data.rankings.knoxFactor.total}
                  rangeLabel={data.rangeLabel}
                />
              </View>

              {/* ── SECTION 2: Scorecards ───────────────── */}
              <View style={styles.section}>
                <SectionHeader title="PERFORMANCE SCORECARDS" />
                <ScrollView
                  horizontal={!isDesktop}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.scoreCardRow,
                    isDesktop && styles.scoreCardGrid,
                  ]}
                >
                  {SCORE_ORDER.map((key, i) => (
                    <ScoreCard
                      key={key}
                      metricKey={key}
                      score={data.politician.scores[key]}
                      ranking={data.rankings[key]}
                      accentColor={METRIC_COLORS[key]}
                      targetId={data.politician.id}
                      delay={i * 60}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* ── SECTION 3: Posts ────────────────────── */}
              <View style={styles.section}>
                <SectionHeader title={`ALL POSTS · ${data.allPosts.length} TOTAL`} />
                {data.allPosts.length === 0 ? (
                  <Text style={styles.emptyPosts}>
                    No posts found for this account.
                  </Text>
                ) : (
                  <>
                    <View style={styles.postFeed}>
                      {data.allPosts.slice(0, page * 10).map((post, i) => (
                        <AccountPostCard
                          key={post.postId}
                          post={post}
                          partyKey={data.politician.partyKey}
                          name={data.politician.name}
                          delay={i * 40}
                        />
                      ))}
                    </View>
                    {page * 10 < data.allPosts.length && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.loadMore,
                          pressed && styles.loadMorePressed,
                        ]}
                        onPress={() => setPage(p => p + 1)}
                      >
                        <Text style={styles.loadMoreText}>
                          LOAD MORE · {data.allPosts.length - page * 10} REMAINING
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>

              <View style={styles.bottomPad} />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <DevPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  scoreCardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  scoreCardGrid: {
    flexWrap: 'wrap',
  },
  postFeed: {
    gap: spacing.md,
  },
  emptyPosts: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  bottomPad: {
    height: spacing.xxxl,
  },
  loadMore: {
    alignSelf:       'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    borderRadius:    20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop:       spacing.sm,
  },
  loadMorePressed: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  loadMoreText: {
    fontFamily:    font.bold,
    fontSize:      11,
    color:         neutral.textDim,
    letterSpacing: 1.4,
  },
});
