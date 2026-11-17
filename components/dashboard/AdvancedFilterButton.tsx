import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { accent, glass, neutral } from '@/theme/colors';
import { radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * AdvancedFilterButton
 * ---------------------
 * Magnifying glass next to a post count that toggles the AdvancedFilterPanel.
 * Turns indigo while the panel is open or rules are set, and shows the rule
 * count. Used by the dashboard Post Feed and the account page Best posts.
 *
 * One job: the toggle for an advanced filter panel.
 */
interface Props {
  open:      boolean;
  ruleCount: number;
  onPress:   () => void;
}

export function AdvancedFilterButton({ open, ruleCount, onPress }: Props) {
  const lit = open || ruleCount > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.btn,
        open && styles.btnActive,
        ruleCount > 0 && styles.btnHasRules,
        hovered && { opacity: 0.85 },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Toggle advanced filter"
    >
      <FontAwesome6 name="magnifying-glass" size={12} color={lit ? accent.indigo : neutral.textMid} solid />
      {ruleCount > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{ruleCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    width:           32,
    height:          32,
    justifyContent:  'center',
    borderRadius:    radius.pill,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  btnActive: {
    borderColor:     accent.indigo,
    backgroundColor: accent.indigo + '20',
  },
  btnHasRules: {
    width:             'auto' as any,
    paddingHorizontal: 8,
  },
  count: {
    backgroundColor:   accent.indigo,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:      radius.pill,
    minWidth:          16,
    alignItems:        'center',
  },
  countText: {
    fontFamily: font.bold,
    fontSize:   9,
    color:      '#fff',
  },
});
