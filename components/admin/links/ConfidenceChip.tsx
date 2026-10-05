import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import type { LinkConfidence } from '@/lib/accountLinks';
import { neutral, party } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

/**
 * ConfidenceChip
 * ---------------
 * How sure the matcher was, and why. Colour carries the same meaning every
 * time: green means the handle itself matched, amber means a name did, red
 * means more than one person fit and the matcher refused to choose.
 *
 * One job: label a match's strength.
 */

const TONE: Record<LinkConfidence, string> = {
  exact:     party.green.base,
  high:      party.green.glow,
  medium:    party.libdem.base,
  low:       party.dup.base,
  ambiguous: party.labour.base,
  none:      neutral.stroke,
};

const WORDING: Record<LinkConfidence, string> = {
  exact:     'Handle matched',
  high:      'Name matched',
  medium:    'Name is close',
  low:       'Surname only',
  ambiguous: 'More than one fit',
  none:      'No match found',
};

interface Props {
  confidence: LinkConfidence;
  score?:     number | null;
  method?:    string | null;
}

export function ConfidenceChip({ confidence, score, method }: Props) {
  const tone = TONE[confidence] ?? neutral.stroke;

  return (
    <View style={[styles.chip, { borderColor: tone }]}>
      <DevLabel name="ConfidenceChip" />
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={styles.text}>
        {WORDING[confidence] ?? confidence}
        {typeof score === 'number' && score > 0 ? ` · ${Math.round(score * 100)}%` : ''}
        {method ? ` · ${method}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    borderWidth: 1, borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  text: { color: neutral.text, fontSize: 12 },
});
