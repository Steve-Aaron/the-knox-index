import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InfoTip } from '@/components/primitives/InfoTip';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, status } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { Politician } from '@/data/types';
import { computeFollowerQuality, FOLLOWER_QUALITY, type FollowerQualityVerdict, type ReachPlatform } from '@/data/knoxConfig';

/**
 * FollowerQualityFlag
 * --------------------
 * Renders the follower-quality ratio + verdict for an account. The maths and
 * thresholds live in @/data/knoxConfig (see FOLLOWER_QUALITY + computeFollowerQuality)
 * so they sit alongside the Knox Factor tuning knobs — edit there to rebalance.
 *
 * Each platform is judged on its own followers and posts, against that
 * platform's thresholds: X reach per follower runs far lower than TikTok's, so
 * a combined ratio would mislabel both. An account on both shows one row each.
 *
 * One job: render the ratio + a verdict label per platform. No maths inline.
 */

interface Props {
  politician: Politician;
  /** Posts to judge reach on, when the caller has them (the account page). */
  posts?:     readonly { views: number; platform?: ReachPlatform }[];
}

const PLATFORM_NAME: Record<ReachPlatform, string> = { tiktok: 'TikTok', x: 'X' };

interface Row extends FollowerQualityVerdict {
  platform: ReachPlatform;
  label:    string;
  hint:     string;
}

/** Follower count on one platform; the row's total when it is single-platform. */
function followersOn(politician: Politician, platform: ReachPlatform): number {
  const presence = politician.platforms?.find(p => p.platform === platform);
  if (presence) return presence.followers;
  return politician.totals.followers;
}

function pct(ratio: number): string {
  const v = ratio * 100;
  return `${v < 1 ? v.toFixed(1) : v.toFixed(0)}%`;
}

function bandLabel(followers: number): string {
  if (followers >= 10_000_000) return '10M+ followers';
  if (followers >= 1_000_000)  return '1M to 10M followers';
  if (followers >= 10_000)     return '10k to 1M followers';
  return 'under 10k followers';
}

function describe(v: FollowerQualityVerdict, platform: ReachPlatform, followers: number): { label: string; hint: string } {
  if (v.tone === 'neutral' && v.neutralReason === 'low_followers') {
    return {
      label: 'Sample too small to flag',
      hint:  `Need at least ${(FOLLOWER_QUALITY.minFollowersGate / 1000).toFixed(0)}k followers before the views-to-followers ratio is meaningful.`,
    };
  }
  if (v.tone === 'neutral') {
    return {
      label: 'No recent posts on record',
      hint:  'We can only judge audience quality once we have post-level reach data.',
    };
  }
  const { amber, red, typical } = v.thresholds;
  const peers = typical !== null
    ? ` A typical ${PLATFORM_NAME[platform]} account with ${bandLabel(followers)} reaches about ${pct(typical)}.`
    : '';
  if (v.tone === 'red') {
    return {
      label: 'Unusually low reach for follower count',
      hint:  `Less than ${pct(red)} of followers saw an average recent post.${peers} Worth investigating whether the audience is real or located in the same country as the account.`,
    };
  }
  if (v.tone === 'amber') {
    return {
      label: 'Reach low for follower count',
      hint:  `Below ${pct(amber)} of followers saw an average recent post.${peers} This is on the edge: it could be an off-platform audience, or inflated followers.`,
    };
  }
  return {
    label: 'Reach looks healthy for size',
    hint:  `Followers are seeing posts at a normal rate for a ${PLATFORM_NAME[platform]} account this size.`,
  };
}

export function FollowerQualityFlag({ politician, posts }: Props) {
  const rows = useMemo<Row[]>(() => {
    const allPosts = posts ?? politician.recentPosts ?? [];
    // Posts from before multi-platform carry no platform: they are TikTok.
    const platformOf = (p: { platform?: ReachPlatform }): ReachPlatform => p.platform ?? 'tiktok';

    const single: ReachPlatform | null =
      politician.platform === 'x' || politician.platform === 'tiktok' ? politician.platform : null;
    const platforms: ReachPlatform[] = single
      ? [single]
      : (['tiktok', 'x'] as const).filter(pl =>
          politician.platforms?.some(p => p.platform === pl) || allPosts.some(p => platformOf(p) === pl));
    if (platforms.length === 0) platforms.push('tiktok');

    const graded = platforms.map<Row>(platform => {
      const platformPosts = single ? allPosts : allPosts.filter(p => platformOf(p) === platform);
      const followers = followersOn(politician, platform);
      const avgViews  = platformPosts.length > 0
        ? platformPosts.reduce((s, p) => s + p.views, 0) / platformPosts.length
        : 0;
      const v = computeFollowerQuality(avgViews, followers, platformPosts.length, platform);
      return { ...v, platform, ...describe(v, platform, followers) };
    });

    // On two platforms, a platform with nothing to grade adds only noise.
    const withRatio = graded.filter(r => r.ratio !== null);
    return graded.length > 1 && withRatio.length > 0 ? withRatio : graded.slice(0, 1);
  }, [politician, posts]);

  const showPlatform = rows.length > 1;

  return (
    <View style={styles.stack}>
      <DevLabel name="FollowerQualityFlag" />
      {rows.map(row => {
        const tint = row.tone === 'red' ? status.bad
                   : row.tone === 'amber' ? status.warn
                   : row.tone === 'green' ? status.good
                   : neutral.textDim;
        return (
          <View key={row.platform} style={[styles.wrap, { borderColor: tint + '55', backgroundColor: tint + '12' }]}>
            <View style={styles.row}>
              <Text style={[styles.dot, { color: tint }]}>●</Text>
              <Text style={[styles.label, { color: tint }]}>
                {showPlatform ? `${PLATFORM_NAME[row.platform]}: ` : ''}{row.label}
              </Text>
              <InfoTip text={row.hint} width={260} />
            </View>
            {row.ratio !== null ? (
              <Text style={styles.ratio}>
                Avg views per post · followers ratio:{' '}
                <Text style={[styles.ratioValue, { color: tint }]}>
                  {(row.ratio * 100).toFixed(2)}%
                </Text>
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
  wrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    fontSize: 12,
    lineHeight: 12,
  },
  label: {
    ...type.caption,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  ratio: {
    ...type.body,
    fontSize: 12,
    color: neutral.textDim,
  },
  ratioValue: {
    fontFamily: font.mono,
    fontWeight: '700',
  },
});
