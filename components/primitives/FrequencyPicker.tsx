import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { knox, neutral, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * FrequencyPicker
 * ----------------
 * One job: pick how often the user wants the briefing — Daily, Weekly,
 * or None — and emit the corresponding two-boolean consent pair.
 *
 * The component owns mutual exclusion: picking 'Daily' emits
 * { daily: true, weekly: false }; picking 'Weekly' inverts it; 'None'
 * clears both. Parents never have to enforce this themselves.
 *
 * Visual language: three square-cornered buttons in a row, active one
 * filled with Knox primary pink, others in glass.fill. Matches the rest
 * of the app's square-button hover-fill pattern.
 */

interface Props {
  /** Whether the daily-briefing consent flag is currently set. */
  daily:    boolean;
  /** Whether the weekly-briefing consent flag is currently set. */
  weekly:   boolean;
  /** Fired with the new mutually-exclusive pair. */
  onChange: (next: { daily: boolean; weekly: boolean }) => void;
  /** Optional disabled state — used while a save is in flight. */
  disabled?: boolean;
}

type Option = 'daily' | 'weekly' | 'none';

const OPTIONS: { id: Option; label: string; desc: string }[] = [
  { id: 'daily',  label: 'Daily',  desc: 'A briefing every morning at 8:00.' },
  { id: 'weekly', label: 'Weekly', desc: 'A round-up once a week.' },
  { id: 'none',   label: 'None',   desc: 'No briefing emails.' },
];

export function FrequencyPicker({ daily, weekly, onChange, disabled = false }: Props) {
  // Derive the currently-active option from the boolean pair.
  // If both somehow ended up true (state coming in from an older client),
  // treat it as daily and let the next user action clear the weekly flag.
  const active: Option = daily ? 'daily' : weekly ? 'weekly' : 'none';

  const handlePress = (next: Option) => {
    if (disabled) return;
    onChange({
      daily:  next === 'daily',
      weekly: next === 'weekly',
    });
  };

  return (
    <View style={styles.wrap}>
      <DevLabel name="FrequencyPicker" />
      <View style={styles.row}>
        {OPTIONS.map(opt => {
          const isActive = active === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handlePress(opt.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={`${opt.label} briefing`}
              style={({ pressed, hovered }: any) => [
                styles.option,
                isActive && styles.optionActive,
                hovered && !isActive && styles.optionHovered,
                pressed && { opacity: 0.85 },
                disabled && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              <Text style={[styles.optionDesc, isActive && styles.optionDescActive]}>
                {opt.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  option: {
    flex:              1,
    minWidth:          140,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    backgroundColor:   glass.fill,
    gap:               4,
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  optionHovered: {
    borderColor:     'rgba(232,60,145,0.6)',
    backgroundColor: 'rgba(232,60,145,0.06)',
  },
  optionActive: {
    borderColor:     knox.primaryPink,
    backgroundColor: 'rgba(232,60,145,0.14)',
  },
  optionLabel: {
    fontFamily:    font.bold,
    fontWeight:    '700',
    fontSize:      14,
    color:         neutral.text,
    letterSpacing: 0.4,
  },
  optionLabelActive: {
    color: knox.primaryPink,
  },
  optionDesc: {
    fontFamily: font.ui,
    fontWeight: '400',
    fontSize:   12,
    lineHeight: 16,
    color:      neutral.textDim,
  },
  optionDescActive: {
    color: neutral.textMid,
  },
});
