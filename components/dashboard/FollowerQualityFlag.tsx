import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InfoTip } from '@/components/primitives/InfoTip';
import { neutral, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { Politician } from '@/data/types';

/**
 * FollowerQualityFlag
 * --------------------
 * Heuristic indicator that flags accounts whose recent reach looks anomalously
 * low for their follower count. Answers the brief question 'has this MP bought
 * followers (abroad)?' without making a definitive accusation — we surface the
 * ratio and let the user judge.
 *
 * Heuristic: avgViewsPerPost / totalFollowers. Real political audiences usually
 * show 0.10–0.50 (10–50% of followers see any given post on TikTok). A ratio
 * below 0.03 with a large follower base is a yellow flag worth investigating.
 *
 * One job: render the ratio + a verdict label. No side effects.
 */

interface Props {
  politician: Politician;
}

const SUSPICIOUS_RATIO    = 0.03;   // <3% of followers seeing posts is unusual
const VERY_SUSPICIOUS     = 0.01;   // <1% is a bigger flag
const MIN_FOLLOWERS_GATE  = 25_000; // below this, the ratio is too noisy to judge

export function FollowerQualityFlag({ politician }: Props) {
  const verdict = useMemo(() => {
    const followers = politician.totals.followers;
    const recentPosts = politician.recentPosts ?? [];

    if (followers < MIN_FOLLOWERS_GATE) {
      return { tone: 'neutral' as const, label: 'Sample too small to flag', ratio: null, hint: 'Need at least 25k followers before the views-to-followers ratio is meaningful.' };
    }
    if (recentPosts.length === 0) {
      return { tone: 'neutral' as const, label: 'No recent posts on record', ratio: null, hint: 'We can only judge audience quality once we have post-level reach data.' };
    }

    const avgViews = recentPosts.reduce((s, p) => s + p.views, 0) / recentPosts.length;
    const ratio = avgViews / followers;

    if (ratio < VERY_SUSPICIOUS) {
      return {
        tone: 'red' as const,
        label: 'Unusually low reach for follower count',
        ratio,
        hint: 'Less than 1% of followers saw an average recent post. Worth investigating whether the audience is real or located in the same country as the account.',
      };
    }
    if (ratio < SUSPICIOUS_RATIO) {
      return {
        tone: 'amber' as const,
        label: 'Reach low for follower count',
        ratio,
        hint: 'Below 3% of followers saw an average recent post. This is on the edge — could be off-platform audience, could be inflated followers.',
      };
    }
    return {
      tone: 'green' as const,
      label: 'Reach looks healthy for size',
      ratio,
      hint: 'Followers are seeing posts at a normal rate for an account this size.',
    };
  }, [politician]);

  const tint = verdict.tone === 'red' ? '#ff7a7a'
             : verdict.tone === 'amber' ? accent.amber
             : verdict.tone === 'green' ? accent.mint
             : neutral.textDim;

  return (
    <View style={[styles.wrap, { borderColor: tint + '55', backgroundColor: tint + '12' }]}>
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
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  ratio: {
    ...type.body,
    fontSize: 11,
    color: neutral.textDim,
  },
  ratioValue: {
    fontFamily: font.mono,
    fontWeight: '700',
  },
});
