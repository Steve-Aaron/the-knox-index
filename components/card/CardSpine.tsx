import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { party, PartyKey } from '@/theme/colors';
import { card, radius } from '@/theme/spacing';

/**
 * CardSpine
 * ----------
 * The coloured bar down the left edge of the card — identifies party at a
 * glance and doubles as a glow source. One job.
 */
interface Props {
  partyKey: PartyKey;
}

export function CardSpine({ partyKey }: Props) {
  const colour = party[partyKey];
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <LinearGradient
        colors={[colour.base, colour.glow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bar}
      />
      {/* Soft outer glow, achieved via a shadow on native and box-shadow equivalent on web. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            shadowColor: colour.base,
            shadowOpacity: 0.65,
            shadowRadius: 16,
            shadowOffset: { width: 4, height: 0 },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: card.spineWidth,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    overflow: 'visible',
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
});
