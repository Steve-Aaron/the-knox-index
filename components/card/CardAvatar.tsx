import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { party, PartyKey, neutral } from '@/theme/colors';
import { font } from '@/theme/typography';

/**
 * CardAvatar
 * -----------
 * Circular avatar with party-coloured ring. Image source optional — when
 * missing, shows initials against a subtle dark fill. One job.
 */
interface Props {
  partyKey: PartyKey;
  initials: string;
  size?: number;
}

export function CardAvatar({ partyKey, initials, size = 56 }: Props) {
  const colour = party[partyKey];
  const ring = size;
  const inner = size - 6;

  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={[colour.base, colour.glow]}
        style={{ width: ring, height: ring, borderRadius: ring / 2, position: 'absolute' }}
      />
      <View
        style={[
          styles.inner,
          { width: inner, height: inner, borderRadius: inner / 2 },
        ]}
      >
        <Text style={styles.initials}>{initials}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    backgroundColor: neutral.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: font.bold,
    color: neutral.text,
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
