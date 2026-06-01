import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral } from '@/theme/colors';
import { font } from '@/theme/typography';
import { layout } from '@/theme/layoutTokens';

/**
 * ScoreBar
 * ---------
 * One axis of a performance breakdown: a short uppercase label on the left,
 * a horizontal track with a coloured fill in the middle, and the 0-100
 * score on the right.
 *
 * Used in AccountHero for the views / engagement / frequency / followers
 * axes. The 5-char label cap lets all bars share a single, narrow label
 * column without wrapping.
 *
 * One job: show one normalised metric as a horizontal bar.
 */

const SHORT_LABELS: Record<string, string> = {
  VIEWS:      'VIEWS',
  FREQUENCY:  'FREQ.',
  ENGAGEMENT: 'ENG.',
  FOLLOWERS:  'FOLL.',
};

interface Props {
  label: string;
  /** 0..100 normalised score. */
  score: number;
  /** Fill colour (usually the party base). */
  color: string;
}

export function ScoreBar({ label, score, color }: Props) {
  const short = SHORT_LABELS[label] ?? label.slice(0, 5);
  return (
    <View style={styles.row}>
      <DevLabel name="ScoreBar" />
      <Text style={styles.label} numberOfLines={1}>{short}</Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(0, Math.min(100, score))}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.score, { color }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...layout.row },
  label: {
    fontFamily:    font.bold,
    fontSize:      9,
    color:         neutral.textDim,
    letterSpacing: 1.1,
    width:         36,
  },
  track: {
    flex:            1,
    height:          5,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow:        'hidden',
  },
  fill: { height: 5, borderRadius: 3, opacity: 0.85 },
  // 32px fits '100' at fontSize 12.
  score: { fontFamily: font.bold, fontSize: 12, width: 32, textAlign: 'right' },
});
