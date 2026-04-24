import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { MotiView } from 'moti';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { SkeletonBlock } from '@/components/primitives/SkeletonBlock';
import { CountUp, formatters } from '@/components/primitives/CountUp';
import { neutral, accent } from '@/theme/colors';
import { font } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician } from '@/data/types';

/**
 * KeyFindingsBar
 * ---------------
 * Horizontal strip of 4 headline stat tiles derived from the current data set.
 * Each tile has an accent bar, a kicker label, a large value, and an optional
 * sub-label. Animates in on mount. One job: surface the most important numbers.
 */
interface Props {
  politicians: Politician[];
}

interface StatTile {
  kicker:        string;
  tip:           string;
  numericValue?: number;
  textValue?:    string;
  suffix?:       string;
  accentColor:   string;
}

const TILE_WIDTH = 196;

export function KeyFindingsBar({ politicians }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const tiles = useMemo<StatTile[]>(() => {
    const totalViews24h = politicians.reduce((s, p) => s + p.totals.views24h, 0);
    const topPerformer = [...politicians].sort(
      (a, b) => b.scores.knoxFactor - a.scores.knoxFactor
    )[0];
    const allPosts = politicians.flatMap(p =>
      p.recentPosts.map(post => ({ ...post, politician: p }))
    );
    const mostViral = [...allPosts].sort((a, b) => b.views - a.views)[0];

    return [
      {
        kicker:       'Politicians tracked',
        tip:          'The number of political accounts we are actively monitoring on TikTok right now.',
        numericValue: politicians.length,
        suffix:       'active accounts',
        accentColor:  accent.indigo,
      },
      {
        kicker:       "Yesterday's views",
        tip:          "The total number of times videos from all tracked politicians were watched yesterday. Data arrives one day after posting.",
        numericValue: totalViews24h,
        accentColor:  accent.mint,
      },
      {
        kicker:       'Top performer',
        tip:          'The politician with the highest Knox Factor score right now. Knox Factor is our overall performance score that combines views, engagement, posting frequency and follower count.',
        textValue:    topPerformer?.name ?? '—',
        suffix:       topPerformer ? `Knox Factor · ${topPerformer.scores.knoxFactor}` : undefined,
        accentColor:  accent.amber,
      },
      {
        kicker:       'Most viral post',
        tip:          'The single video with the most views across all politicians we track in this period.',
        ...(mostViral
          ? { numericValue: mostViral.views, suffix: mostViral.politician.name }
          : { textValue: 'None yet', suffix: 'No posts recorded this period' }
        ),
        accentColor:  accent.pink,
      },
    ];
  }, [politicians]);

  if (politicians.length === 0) {
    return (
      <View style={styles.rootWrap}>
        <View style={styles.scroll}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBlock key={i} width={TILE_WIDTH} height={88} borderRadius={14} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootWrap}>
      <DevLabel name="KeyFindingsBar" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
      {tiles.map((tile, i) => (
        <MotiView
          key={tile.kicker}
          from={{ opacity: 0, translateY: -8 }}
          animate={{
            opacity:    1,
            translateY: hovered === i ? -3 : 0,
          }}
          transition={{ type: 'timing', duration: hovered === i ? 150 : 200, delay: hovered === i ? 0 : i * 70 }}
          style={styles.tileWrap}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setHovered(i),
            onMouseLeave: () => setHovered(null),
          } as any : {})}
        >
          <GlassSurface
            style={Object.assign(
              {},
              styles.tile,
              Platform.OS === 'web' && hovered === i
                ? { boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${tile.accentColor}22` }
                : {}
            ) as any}
            radius={radius.md}
          >
            <View style={[styles.accentBar, { backgroundColor: tile.accentColor }]} />
            <View style={styles.tileInner}>
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
                <Text style={styles.suffix} numberOfLines={1}>
                  {tile.suffix}
                </Text>
              ) : null}
            </View>
          </GlassSurface>
        </MotiView>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: {},
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  tileWrap: {
    width: TILE_WIDTH,
  },
  tile: {
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 88,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
  tileInner: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xxs,
    justifyContent: 'center',
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
    fontSize: 9,
  },
  valueNumeric: {
    fontFamily: font.mono,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  valueText: {
    fontFamily: font.ui,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  suffix: {
    ...type.body,
    color: neutral.textMid,
    fontSize: 11,
    marginTop: 2,
  },
});
