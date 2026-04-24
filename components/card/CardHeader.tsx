import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardAvatar } from './CardAvatar';
import { PartyKey, neutral } from '@/theme/colors';
import { type } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * CardHeader
 * -----------
 * Avatar + identity block (name, role, party). Composition only — no logic.
 */
interface Props {
  name: string;
  role: string;
  partyLabel: string;
  partyKey: PartyKey;
  initials: string;
}

export function CardHeader({ name, role, partyLabel, partyKey, initials }: Props) {
  return (
    <View style={styles.row}>
      <CardAvatar partyKey={partyKey} initials={initials} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {role}
        </Text>
        <Text style={[styles.party, { color: neutral.textDim }]} numberOfLines={1}>
          {partyLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: { ...type.title, color: neutral.text },
  meta: { ...type.body, color: neutral.textMid },
  party: { ...type.caption, fontVariant: ['small-caps'] as any },
});
