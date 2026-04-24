import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatPill } from './StatPill';
import type { TopTrumpScores, ScoreKey } from '@/data/types';
import { spacing } from '@/theme/spacing';
import { party, PartyKey } from '@/theme/colors';

/**
 * StatGrid
 * ---------
 * 2x2 pill grid of the four secondary scores (the fifth being the headline).
 * Purely layout / mapping. One job.
 */
interface Props {
  scores: TopTrumpScores;
  partyKey: PartyKey;
  headlineKey: ScoreKey;
}

const LABELS: Record<ScoreKey, string> = {
  views:       'Views',
  frequency:   'Frequency',
  engagement:  'Engagement',
  followers:   'Followers',
  knoxFactor:  'Knox',
};

export function StatGrid({ scores, partyKey, headlineKey }: Props) {
  const keys = (Object.keys(scores) as ScoreKey[]).filter(k => k !== headlineKey);
  const colour = party[partyKey];

  return (
    <View style={styles.grid}>
      {keys.map(k => (
        <View key={k} style={styles.cell}>
          <StatPill label={LABELS[k]} value={scores[k]} accentColour={colour.base} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
});
