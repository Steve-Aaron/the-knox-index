import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { CardAvatar } from '@/components/card/CardAvatar';
import { DashCard } from '@/components/primitives/DashCard';
import { CountUp } from '@/components/primitives/CountUp';
import { neutral, glass, party } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type, font } from '@/theme/typography';
import type { ScoreKey, AccountRanking, AccountRankEntry } from '@/data/types';

/**
 * ScoreCard
 * ----------
 * Displays one score metric for an account:
 *   - Their normalised score (0–100)
 *   - Their rank among all accounts
 *   - A mini top-5 leaderboard, with their row highlighted or appended
 *
 * One job: rank one metric visually.
 */

const SCORE_LABELS: Record<ScoreKey, string> = {
  knoxFactor:  'Knox Factor',
  views:       'Views',
  engagement:  'Engagement',
  frequency:   'Frequency',
  followers:   'Followers',
};

const SCORE_DESCS: Record<ScoreKey, string> = {
  knoxFactor:  'Overall influence score',
  views:       'Average views per post',
  engagement:  'Likes + comments + saves + shares / views',
  frequency:   'Posts in the selected period',
  followers:   'Total follower count',
};

interface Props {
  metricKey:   ScoreKey;
  score:       number;
  ranking:     AccountRanking;
  accentColor: string;
  targetId:    string;
  delay?:      number;
}

function LeaderboardRow({
  entry,
  rank,
  isTarget,
  accentColor,
}: {
  entry:       AccountRankEntry;
  rank:        number;
  isTarget:    boolean;
  accentColor: string;
}) {
  const colour = party[entry.partyKey];
  return (
    <View style={[styles.row, isTarget && { backgroundColor: accentColor + '14', borderColor: accentColor + '55' }]}>
      <Text style={[styles.rowRank, isTarget && { color: accentColor }]}>
        #{rank}
      </Text>
      <CardAvatar
        partyKey={entry.partyKey}
        initials={entry.avatarInitials}
        avatarUrl={entry.avatarUrl}
        size={28}
      />
      <Text style={[styles.rowName, isTarget && { color: neutral.text, fontWeight: '700' }]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.rowScore, { color: isTarget ? accentColor : colour.glow }]}>
        {entry.score}
      </Text>
    </View>
  );
}

export function ScoreCard({ metricKey, score, ranking, accentColor, targetId, delay = 0 }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay }}
      style={styles.motionWrap}
    >
      <DashCard style={styles.card} topAccent={undefined}>
        {/* Accent bar keyed to this metric */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.body}>
          {/* Header */}
          <Text style={styles.kicker}>{SCORE_LABELS[metricKey].toUpperCase()}</Text>
          <Text style={styles.desc}>{SCORE_DESCS[metricKey]}</Text>

          {/* Score + rank */}
          <View style={styles.scoreRow}>
            <CountUp value={score} style={[styles.score, { color: accentColor }]} />
            <View style={styles.rankBadge}>
              <Text style={[styles.rankText, { color: accentColor }]}>
                #{ranking.rank}
              </Text>
              <Text style={styles.rankOf}>of {ranking.total}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Top 5 leaderboard */}
          <View style={styles.leaderboard}>
            {ranking.top5.map((entry, i) => (
              <LeaderboardRow
                key={entry.id}
                entry={entry}
                rank={i + 1}
                isTarget={entry.id === targetId}
                accentColor={accentColor}
              />
            ))}

            {/* If target outside top 5: ellipsis + ±2 context rows */}
            {!ranking.targetInTop5 && ranking.contextRows && ranking.contextRows.length > 0 && (
              <>
                <View style={styles.ellipsisRow}>
                  <Text style={styles.ellipsis}>· · ·</Text>
                </View>
                {ranking.contextRows.map(({ entry, rank }) => (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    rank={rank}
                    isTarget={entry.id === targetId}
                    accentColor={accentColor}
                  />
                ))}
              </>
            )}
          </View>
        </View>
      </DashCard>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  motionWrap: {
    flex: 1,
    minWidth: 260,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    width: '100%',
    opacity: 0.85,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: font.bold,
    fontSize: 10,
    color: neutral.textDim,
    letterSpacing: 1.6,
  },
  desc: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  score: {
    fontFamily: font.bold,
    fontSize: 48,
    lineHeight: 52,
  },
  rankBadge: {
    gap: 2,
  },
  rankText: {
    fontFamily: font.bold,
    fontSize: 18,
  },
  rankOf: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: glass.border,
    marginVertical: spacing.xs,
  },
  leaderboard: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowRank: {
    fontFamily: font.bold,
    fontSize: 11,
    color: neutral.textDim,
    width: 28,
  },
  rowName: {
    ...type.body,
    fontSize: 13,
    color: neutral.textMid,
    flex: 1,
  },
  rowScore: {
    fontFamily: font.bold,
    fontSize: 13,
  },
  ellipsisRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  ellipsis: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 3,
  },
});
