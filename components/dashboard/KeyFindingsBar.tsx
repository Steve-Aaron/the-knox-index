import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { Kicker } from '@/components/ui/Kicker';
import { neutral, accent, party, brand, knox, dataVis } from '@/theme/colors';
import { type, font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { breakpoints } from '@/theme/breakpoints';
import type { Politician } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/** Short possessive label for tile kickers. */
const RANGE_SHORT: Record<TimeRange, string> = {
  yesterday: "Yesterday's",
  week:      "This week's",
  month:     "This month's",
  year:      "This year's",
  lifetime:  'Lifetime',
};

/** Fixed tile width for mobile — tiles scroll horizontally. */
const TILE_WIDTH_MOBILE = 200;

/** Return first N words of a string, appending ellipsis if truncated. */
function firstWords(str: string, n = 5): string {
  const words = str.trim().split(/\s+/);
  if (words.length <= n) return str;
  return words.slice(0, n).join(' ') + '…';
}

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
}

interface StatTile {
  kicker:        string;
  tip:           string;
  numericValue?: number;
  textValue?:    string;
  suffix?:       string;
  accentColor:   string;
}

export function KeyFindingsBar({ politicians, range = 'yesterday' }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rangeLabel = RANGE_SHORT[range];

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= breakpoints.desktop;

  const tiles = useMemo<StatTile[]>(() => {
    const topPerformer = [...politicians].sort(
      (a, b) => b.scores.knoxFactor - a.scores.knoxFactor
    )[0];
    const allPosts = politicians.flatMap(p =>
      (p.recentPosts ?? []).map(post => ({ ...post, politician: p }))
    );
    const mostViral        = [...allPosts].sort((a, b) => b.views - a.views)[0];
    const totalViews       = allPosts.reduce((s, p) => s + p.views, 0);
    const postCount        = allPosts.length;
    const avgViewsPerPost  = postCount > 0 ? Math.round(totalViews / postCount) : 0;

    return [
      {
        kicker:       'Politicians tracked',
        tip:          'The number of political accounts we are actively monitoring on TikTok right now.',
        numericValue: politicians.length,
        suffix:       'active accounts',
        accentColor:  accent.indigo,
      },
      {
        kicker:       `${rangeLabel} views`,
        tip:          `Total views across every tracked post in this period. Data arrives one day after posting.`,
        numericValue: totalViews,
        suffix:       postCount > 0 ? `across ${postCount} post${postCount === 1 ? '' : 's'}` : undefined,
        accentColor:  accent.mint,
      },
      {
        kicker:       'Avg views / post',
        tip:          'Average view count across recent processed posts for all tracked politicians in this period.',
        numericValue: avgViewsPerPost,
        suffix:       'views per post',
        accentColor:  accent.amber,
      },
      {
        kicker:       'Most viral post',
        tip:          'The single video with the most views across all politicians we track in this period.',
        ...(mostViral
          ? {
              numericValue: mostViral.views,
              suffix: mostViral.caption ? firstWords(mostViral.caption) : mostViral.politician.name,
            }
          : { textValue: 'None yet', suffix: 'No posts recorded this period' }
        ),
        accentColor:  dataVis[4],
      },
      {
        kicker:       'Top performer',
        tip:          'The politician with the highest Knox Factor score right now. Knox Factor combines views, engagement, posting frequency and follower count.',
        textValue:    topPerformer?.name ?? '—',
        suffix:       topPerformer ? `Knox Factor · ${topPerformer.scores.knoxFactor}` : undefined,
        accentColor:  topPerformer ? party[topPerformer.partyKey].base : accent.amber,
      },
    ];
  }, [politicians, rangeLabel]);

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
          : { width: TILE_WIDTH_MOBILE },
        Platform.OS === 'web' && hovered === i ? { transform: [{ translateY: -2 }] } : {},
      ]}
      {...(Platform.OS === 'web' ? {
        onMouseEnter: () => setHovered(i),
        onMouseLeave: () => setHovered(null),
      } as any : {})}
    >
      {/* Hero number on top — drives the visual weight */}
      {tile.numericValue !== undefined ? (
        <CountUp
          value={tile.numericValue}
          format={formatters.compact}
          style={[styles.valueNumeric, { color: tile.accentColor }]}
        />
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
    <View style={styles.strip}>
      <DevLabel name="header-scorecard" />

      {politicians.length === 0 ? (
        <View style={styles.row}>{skeletonNodes}</View>
      ) : isDesktop ? (
        <View style={styles.row}>{tileNodes}</View>
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
  tileBox: {
    paddingVertical: spacing.md,
    gap:             6,
  },
  tileBoxFlex: { flex: 1 },
  tileBoxAuto: { flexShrink: 0 },

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
