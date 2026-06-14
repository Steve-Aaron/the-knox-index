import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CardAvatar } from '@/components/card/CardAvatar';
import { CountUp } from '@/components/primitives/CountUp';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, party, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import type { Politician, LeaderboardSortKey } from '@/data/types';
import { leaderboardScore, viewsScore, engagementScore, engagementRate, viralityScoreDisplay, viralityRatioFor } from '@/data/leaderboard';

/**
 * RankBoardRow
 * -------------
 * A single politician row inside the RankBoard. Shows rank, avatar, name,
 * party stripe, and the currently-selected score. Pressable to focus card.
 * One job.
 */
interface Props {
  politician: Politician;
  rank: number;
  headlineKey: LeaderboardSortKey;
  active: boolean;
  onPress: () => void;
  /** False when a time filter is active — Knox displays the range-scoped score. */
  isLifetime?: boolean;
  /** Top page's views in the list — the 100/100 reference for the views score. */
  viewsMax?: number;
  /** Engagement display reference rate (%) — tops out at min(this, 15%). */
  engReference?: number;
}

export function RankBoardRow({ politician, rank, headlineKey, active, onPress, isLifetime = true, viewsMax = 0, engReference = 15 }: Props) {
  const colour  = party[politician.partyKey];
  // An account is silent if it has no posts this week AND no views yesterday.
  // knoxFactor === 0 is a reliable proxy once the @ join bug is fixed.
  const silent  = politician.scores.knoxFactor === 0
    && politician.totals.postsThisWeek === 0;
  // Views = 0–100 log2 score vs the top page. Engagement = 0–100 filter-scaled
  // display score (tops out at min(filter rate, 15%)). Everything else reads the
  // canonical leaderboard score. All shown out of 100.
  const isViews = headlineKey === 'views';
  const score   = isViews
    ? viewsScore(politician.totals.viewsInRange, viewsMax)
    : headlineKey === 'engagement'
    ? engagementScore(engagementRate(politician), engReference)
    : headlineKey === 'virality'
    ? viralityScoreDisplay(viralityRatioFor(politician, isLifetime))
    : leaderboardScore(politician, headlineKey, isLifetime);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.row,
        silent && styles.rowSilent,
        active && { borderColor: accent.indigo, backgroundColor: 'rgba(95,100,189,0.08)' },
        hovered && !active ? { borderColor: neutral.strokeHi } : null,
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <DevLabel name="RankBoardRow" />
      <Text
        style={[styles.rank, silent ? styles.rankSilent : { color: colour.glow }]}
        numberOfLines={1}
      >
        #{rank}
      </Text>
      <CardAvatar partyKey={politician.partyKey} initials={politician.avatarInitials} size={36} avatarUrl={politician.avatarUrl} />
      <View style={styles.id}>
        <Text style={[styles.name, silent && styles.textSilent]} numberOfLines={1}>
          {politician.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>{politician.partyLabel}</Text>
      </View>

      {silent ? (
        <View style={styles.silentBadge}>
          <Text style={styles.silentBadgeText}>SILENT</Text>
        </View>
      ) : (
        <View style={styles.score}>
          <CountUp value={score} style={[styles.scoreValue, { color: colour.glow }]} />
          <Text style={styles.scoreUnit}>/ 100</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.card,
    borderRadius: radius.md,
    ...Platform.select({
      web: { transitionProperty: 'border-color, background-color', transitionDuration: '180ms', cursor: 'pointer' } as any,
      default: {},
    }),
  },
  rank: {
    ...type.caption,
    fontSize: 12,
    // 40px fits '#999' on one line at the row's caption font size.
    // numberOfLines={1} on the Text element is the belt-and-braces safety.
    width: 40,
  },
  id: { flex: 1, minWidth: 0 },
  name: { ...type.body, color: neutral.text, fontSize: 16, fontWeight: '700' },
  meta: { ...type.caption, color: neutral.textDim, fontSize: 12, marginTop: 1, fontVariant: ['small-caps'] as any },

  // Silent state
  rowSilent:  { opacity: 0.45 },
  rankSilent: { ...type.caption, fontSize: 12, width: 40, color: neutral.textDim },
  textSilent: { color: neutral.textDim },
  silentBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  silentBadgeText: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  scoreValue: {
    ...type.numberMd,
    fontSize: 16,
  },
  scoreUnit: {
    ...type.caption,
    color: neutral.textDim,
    fontSize: 12,
  },
});
