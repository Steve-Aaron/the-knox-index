import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { DashCard } from '@/components/primitives/DashCard';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { neutral, accent, party, brand } from '@/theme/colors';
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
        kicker:       'Top performer',
        tip:          'The politician with the highest Knox Factor score right now. Knox Factor combines views, engagement, posting frequency and follower count.',
        textValue:    topPerformer?.name ?? '—',
        suffix:       topPerformer ? `Knox Factor · ${topPerformer.scores.knoxFactor}` : undefined,
        accentColor:  topPerformer ? party[topPerformer.partyKey].base : accent.amber,
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
        accentColor:  accent.pink,
      },
    ];
  }, [politicians, rangeLabel]);

  // ── Tile nodes — plain JSX, no component defined inside render ──────────────
  // Entrance animation uses `animate` with a stable value so it only fires once.
  // Hover lift is applied as an inline style update via `hovered` state — this
  // does NOT re-trigger the MotiView entrance because `from` is never re-evaluated
  // after the initial mount (MotiView only reads `from` once).
  const tileNodes = tiles.map((tile, i) => (
    <React.Fragment key={tile.kicker}>
      {i > 0 && <View style={styles.divider} />}
      <MotiView
        from={{ opacity: 0, translateY: -5 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 280, delay: i * 55 }}
        style={[
          styles.tileBox,
          isDesktop ? styles.tileBoxFlex : { width: TILE_WIDTH_MOBILE },
          // Hover lift applied as a plain style — does not restart MotiView animation
          Platform.OS === 'web' && hovered === i ? { transform: [{ translateY: -2 }] } : {},
        ]}
        {...(Platform.OS === 'web' ? {
          onMouseEnter: () => setHovered(i),
          onMouseLeave: () => setHovered(null),
        } as any : {})}
      >
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>{tile.kicker.toUpperCase()}</Text>
          <InfoTip text={tile.tip} placement="below" width={220} />
        </View>
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
        {tile.suffix ? (
          <Text style={styles.suffix} numberOfLines={1}>{tile.suffix}</Text>
        ) : null}
      </MotiView>
    </React.Fragment>
  ));

  // ── Skeleton — same unified surface, placeholder blocks per tile ─────────────
  const skeletonNodes = [0, 1, 2, 3, 4].map(i => (
    <React.Fragment key={i}>
      {i > 0 && <View style={styles.divider} />}
      <View style={[styles.tileBox, styles.tileBoxFlex]}>
        <SkeletonBlock height={14} borderRadius={4} style={{ width: '55%', marginBottom: 8 }} />
        <SkeletonBlock height={32} borderRadius={6} style={{ width: '70%', marginBottom: 6 }} />
        <SkeletonBlock height={12} borderRadius={4} style={{ width: '45%' }} />
      </View>
    </React.Fragment>
  ));

  return (
    <DashCard style={styles.strip}>
      <DevLabel name="KeyFindingsBar" />

      {politicians.length === 0 ? (
        // Skeleton — always a plain row (no scroll needed, flex:1 tiles)
        <View style={styles.row}>{skeletonNodes}</View>
      ) : isDesktop ? (
        // Desktop — flex row, tiles expand equally, no scroll
        <View style={styles.row}>{tileNodes}</View>
      ) : (
        // Mobile / tablet — horizontal scroll inside the strip
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileRow}
        >
          {tileNodes}
        </ScrollView>
      )}
    </DashCard>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    overflow: 'hidden',
  },
  // Desktop inner row — tiles flex equally
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  // Mobile scroll content container
  mobileRow: {
    flexDirection: 'row',
  },
  // Shared tile base — padding, spacing
  tileBox: {
    padding: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.xxs,
    justifyContent: 'center',
  },
  // Desktop tile — flex:1 so all 5 split the strip equally
  tileBoxFlex: {
    flex: 1,
  },
  // Thin vertical divider between tiles
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignSelf: 'stretch',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  kicker: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  valueNumeric: {
    fontFamily: font.mono,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  valueText: {
    fontFamily: font.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  suffix: {
    ...type.body,
    color: neutral.textDim,
    fontSize: 12,
    marginTop: 2,
  },
});
