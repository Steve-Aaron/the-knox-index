import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InfoTip } from '@/components/primitives/InfoTip';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { Politician } from '@/data/types';
import { computeFollowerQuality, FOLLOWER_QUALITY } from '@/data/knoxConfig';

/**
 * FollowerQualityFlag
 * --------------------
 * Renders the follower-quality ratio + verdict for an account. The maths and
 * thresholds live in @/data/knoxConfig (see FOLLOWER_QUALITY + computeFollowerQuality)
 * so they sit alongside the Knox Factor tuning knobs — edit there to rebalance.
 *
 * This component is purely presentational: it asks computeFollowerQuality()
 * for a verdict tone and ratio, then maps the tone to a colour + label + hint.
 *
 * One job: render the ratio + a verdict label. No maths inline.
 */

interface Props {
  politician: Politician;
}

export function FollowerQualityFlag({ politician }: Props) {
  const verdict = useMemo(() => {
    const followers   = politician.totals.followers;
    const recentPosts = politician.recentPosts ?? [];
    const postCount   = recentPosts.length;
    const avgViews    = postCount > 0
      ? recentPosts.reduce((s, p) => s + p.views, 0) / postCount
      : 0;

    const v = computeFollowerQuality(avgViews, followers, postCount);

    // Map the data-layer verdict to UI copy. Verdict labels and hints stay
    // here in the component so the config file remains free of presentation.
    if (v.tone === 'neutral' && v.neutralReason === 'low_followers') {
      return {
        ...v,
        label: 'Sample too small to flag',
        hint:  `Need at least ${(FOLLOWER_QUALITY.minFollowersGate / 1000).toFixed(0)}k followers before the views-to-followers ratio is meaningful.`,
      };
    }
    if (v.tone === 'neutral' && v.neutralReason === 'no_posts') {
      return {
        ...v,
        label: 'No recent posts on record',
        hint:  'We can only judge audience quality once we have post-level reach data.',
      };
    }
    if (v.tone === 'red') {
      return {
        ...v,
        label: 'Unusually low reach for follower count',
        hint:  `Less than ${(FOLLOWER_QUALITY.verySuspiciousRatio * 100).toFixed(0)}% of followers saw an average recent post. Worth investigating whether the audience is real or located in the same country as the account.`,
      };
    }
    if (v.tone === 'amber') {
      return {
        ...v,
        label: 'Reach low for follower count',
        hint:  `Below ${(FOLLOWER_QUALITY.suspiciousRatio * 100).toFixed(0)}% of followers saw an average recent post. This is on the edge — could be off-platform audience, could be inflated followers.`,
      };
    }
    return {
      ...v,
      label: 'Reach looks healthy for size',
      hint:  'Followers are seeing posts at a normal rate for an account this size.',
    };
  }, [politician]);

  const tint = verdict.tone === 'red' ? '#ff7a7a'
             : verdict.tone === 'amber' ? accent.amber
             : verdict.tone === 'green' ? accent.mint
             : neutral.textDim;

  return (
    <View style={[styles.wrap, { borderColor: tint + '55', backgroundColor: tint + '12' }]}>
      <DevLabel name="FollowerQualityFlag" />
      <View style={styles.row}>
        <Text style={[styles.dot, { color: tint }]}>●</Text>
        <Text style={[styles.label, { color: tint }]}>{verdict.label}</Text>
        <InfoTip text={verdict.hint} width={260} />
      </View>
      {verdict.ratio !== null ? (
        <Text style={styles.ratio}>
          Avg views per post · followers ratio:{' '}
          <Text style={[styles.ratioValue, { color: tint }]}>
            {(verdict.ratio * 100).toFixed(2)}%
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
