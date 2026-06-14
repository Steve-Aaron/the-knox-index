import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Linking, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { Kicker } from '@/components/ui/Kicker';
import { neutral, accent, party, dataVis } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { breakpoints } from '@/theme/breakpoints';
import type { Politician, LifetimeTopPost } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';
import { computeKeyFindings } from '@/lib/keyFindings';

/** Fixed tile width for mobile — tiles scroll horizontally. */
const TILE_WIDTH_MOBILE = 200;

/**
 * KeyFindingsBar
 * ---------------
 * Single unified glass strip with 5 headline stat tiles separated by thin
 * vertical dividers. On desktop all tiles sit in one flex row at equal width.
 * On mobile tiles scroll horizontally inside the strip.
 * One job: surface the most important numbers at a glance.
 */
interface Props {
  politicians: Politician[];
  range?: TimeRange;
  /**
   * DB-wide total post count from useLiveData. When provided (> 0) it drives
   * the "Total posts" tile so the figure reflects everything tracked, not just
   * the posts currently loaded into memory. Falls back to the in-scope count.
   */
  totalPostsInDb?: number;
  /**
   * DB-wide total view count from useLiveData. When provided (> 0) it drives the
   * "Total views" and "Avg views / post" tiles so they're fixed lifetime totals
   * from the post table, not the in-memory range sample.
   */
  totalViewsInDb?: number;
  /**
   * All-time most-viewed post from useLiveData (range-independent). When
   * provided it drives the "Top performing post" tile so the figure is a true
   * lifetime maximum. Falls back to the top post among loaded recentPosts.
   */
  topPost?: LifetimeTopPost | null;
}

interface StatTile {
  kicker:        string;
  tip:           string;
  numericValue?: number;
  textValue?:    string;
  suffix?:       string;
  accentColor:   string;
  /** When set, the tile becomes a link that opens this URL on press. */
  link?:         string;
}

export function KeyFindingsBar({ politicians, totalPostsInDb, totalViewsInDb, topPost: lifetimeTopPost }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= breakpoints.desktop;
  const isMobile  = windowWidth < breakpoints.tablet;

  const tiles = useMemo<StatTile[]>(() => {
    // All aggregation lives in the pure, unit-tested helper. The computed
    // values are only fallbacks now — the headline figures prefer the
    // DB-wide lifetime totals so they stay fixed across timeframes.
    const { politicianCount, totalViews, avgViewsPerPost, totalPosts, topPost } =
      computeKeyFindings(politicians);

    // Prefer the DB-wide totals when supplied; otherwise fall back to in-scope.
    const postsHeadline =
      typeof totalPostsInDb === 'number' && totalPostsInDb > 0 ? totalPostsInDb : totalPosts;
    const viewsHeadline =
      typeof totalViewsInDb === 'number' && totalViewsInDb > 0 ? totalViewsInDb : totalViews;
    const avgHeadline =
      typeof totalViewsInDb === 'number' && totalViewsInDb > 0 &&
      typeof totalPostsInDb === 'number' && totalPostsInDb > 0
        ? Math.round(totalViewsInDb / totalPostsInDb)
        : avgViewsPerPost;

    // Prefer the all-time top post from the API; fall back to the best among
    // loaded posts so the tile still renders before the lifetime value arrives.
    const topView = lifetimeTopPost
      ? {
          views:    lifetimeTopPost.views,
          label:    `by ${lifetimeTopPost.accountName}`,
          partyKey: lifetimeTopPost.partyKey,
          link:     lifetimeTopPost.postUrl || undefined,
        }
      : topPost
        ? {
            views:    topPost.views,
            label:    `by ${topPost.politician.name}`,
            partyKey: topPost.politician.partyKey,
            link:     topPost.postUrl || undefined,
          }
        : null;

    return [
      {
        kicker:       'Politicians tracked',
        tip:          'The number of political accounts we are actively monitoring on TikTok right now.',
        numericValue: politicianCount,
        suffix:       'active accounts',
        accentColor:  accent.indigo,
      },
      {
        kicker:       'Total views',
        tip:          'Total views summed across every tracked post, all time.',
        numericValue: viewsHeadline,
        accentColor:  accent.mint,
      },
      {
        kicker:       'Avg views / post',
        tip:          'Total views divided by total tracked posts, all time.',
        numericValue: avgHeadline,
        suffix:       'views per post',
        accentColor:  accent.amber,
      },
      {
        kicker:       'Total posts',
        tip:          'The total number of posts we have tracked across every monitored politician, all time.',
        numericValue: postsHeadline,
        suffix:       postsHeadline > 0 ? 'posts tracked' : 'No posts recorded yet',
        accentColor:  dataVis[4],
      },
      {
        kicker:       'Top performing post',
        tip:          'The single most-viewed post across the accounts we track, all time.',
        ...(topView
          ? { numericValue: topView.views, suffix: topView.label, link: topView.link }
          : { textValue: 'None yet', suffix: 'No posts recorded yet' }
        ),
        accentColor:  topView ? party[topView.partyKey].base : accent.amber,
      },
    ];
  }, [politicians, totalPostsInDb, totalViewsInDb, lifetimeTopPost]);

  // ── Tile nodes — 'Who Won Davos' style: big number on top, small label below.
  // No card, no dividers. Each tile owns its own breathing room.
  const tileNodes = tiles.map((tile, i) => (
    <MotiView
      key={tile.kicker}
      from={{ opacity: 0, translateY: -5 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay: i * 55 }}
      style={[
        styles.tileBox,
        isDesktop
          ? tile.textValue !== undefined ? styles.tileBoxAuto : styles.tileBoxFlex
          : isMobile ? styles.tileBoxMobile : { width: TILE_WIDTH_MOBILE },
        Platform.OS === 'web' && hovered === i ? { transform: [{ translateY: -2 }] } : {},
      ]}
      {...(Platform.OS === 'web' ? {
        // Per-card module marker — addressable as [data-component="dataScoreCard"].
        dataSet: { component: 'dataScoreCard' },
        onMouseEnter: () => setHovered(i),
        onMouseLeave: () => setHovered(null),
      } as any : {})}
    >
      {/* Hero number on top — drives the visual weight. When the tile has a
          link (the top-performing post), the number opens that post. */}
      {tile.numericValue !== undefined ? (
        tile.link ? (
          <Pressable
            onPress={() => Linking.openURL(tile.link!)}
            accessibilityRole="link"
            accessibilityLabel="Open the top performing post on TikTok"
            style={({ pressed }: any) => [
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
              pressed && { opacity: 0.7 },
            ]}
          >
            <CountUp
              value={tile.numericValue}
              format={formatters.compact}
              style={[styles.valueNumeric, { color: tile.accentColor }]}
            />
          </Pressable>
        ) : (
          <CountUp
            value={tile.numericValue}
            format={formatters.compact}
            style={[styles.valueNumeric, { color: tile.accentColor }]}
          />
        )
      ) : (
        <Text
          style={[styles.valueText, { color: tile.accentColor }]}
          numberOfLines={1}
        >
          {tile.textValue}
        </Text>
      )}
      {/* Label below — tiny caps, info-tip inline */}
      <View style={styles.kickerRow}>
        <Kicker tone='dim' style={{ color: neutral.textMid, letterSpacing: 1.4 }}>{tile.kicker}</Kicker>
        <InfoTip text={tile.tip} placement="below" width={220} />
      </View>
      {tile.suffix ? (
        <Text style={styles.suffix} numberOfLines={1}>{tile.suffix}</Text>
      ) : null}
    </MotiView>
  ));

  // ── Skeleton — same shape, big-number-on-top, small-label-below ──────────
  const skeletonNodes = [0, 1, 2, 3, 4].map(i => (
    <View key={i} style={[styles.tileBox, styles.tileBoxFlex]}>
      <SkeletonBlock height={56} borderRadius={4} style={{ width: '70%', marginBottom: 10 }} />
      <SkeletonBlock height={12} borderRadius={4} style={{ width: '55%', marginBottom: 4 }} />
    </View>
  ));

  return (
    <View
      style={styles.strip}
      // Production-visible module marker — addressable as
      // [data-component="dataScoreCards"] in the DOM on web (all builds).
      {...(Platform.OS === 'web'
        ? ({ dataSet: { component: 'dataScoreCards' } } as any)
        : {})}
    >
      <DevLabel name="dataScoreCards" />

      {politicians.length === 0 ? (
        <View style={styles.row}>{skeletonNodes}</View>
      ) : isDesktop ? (
        <View style={styles.row}>{tileNodes}</View>
      ) : isMobile ? (
        // Mobile: stack the scorecards vertically rather than scroll sideways.
        <View style={styles.mobileStack}>{tileNodes}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileRow}
        >
          {tileNodes}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Davos-style strip — no card chrome, just big numbers floating on the page.
  strip: {
    width:             '100%',
    paddingHorizontal: 0,
    paddingVertical:   spacing.xl,
  },
  row: {
    flexDirection:  'row',
    width:          '100%',
    gap:            spacing.xxl,
    justifyContent: 'space-between',
  },
  mobileRow: {
    flexDirection: 'row',
    gap:           spacing.xl,
  },
  // Mobile: one card per row, full width, stacked vertically.
  mobileStack: {
    flexDirection: 'column',
    width:         '100%',
    gap:           spacing.lg,
  },
  tileBox: {
    paddingVertical: spacing.md,
    gap:             6,
  },
  tileBoxFlex:   { flex: 1 },
  tileBoxAuto:   { flexShrink: 0 },
  // Mobile: full-width and centre-aligned (number, label row and suffix all
  // centred), matching the centred 'THE KNOX INDEX' heading treatment.
  tileBoxMobile: { width: '100%', alignItems: 'center' },

  // Hero number — large, mono, accent-coloured. The Davos visual signature.
  valueNumeric: {
    fontFamily:    font.mono,
    fontSize:      56,
    fontWeight:    '700',
    letterSpacing: -1.5,
    lineHeight:    60,
  },
  valueText: {
    fontFamily:    font.bold,
    fontWeight:    '700',
    fontSize:      56,
    letterSpacing: -0.5,
    lineHeight:    60,
  },

  // Tiny label below — uppercase, dim, info-tip inline
  kickerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     6,
  },
  suffix: {
    ...type.body,
    color:    neutral.textDim,
    fontSize: 12,
  },
});
