import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type, font } from '@/theme/typography';

/**
 * ConsentToggleRow
 * -----------------
 * Pressable row with an animated checkbox, a label, and a description. Used
 * everywhere we ask the user to opt in / out of something (consent rows in
 * the preferences page and the signup profiling modal).
 *
 * One job: render a single consent toggle with consistent visuals and a
 * springy 'check' animation when activated.
 *
 * Replaces ~60 lines of duplicated JSX + styles across preferences.tsx and
 * components/auth/StickyUnlock.tsx.
 */

interface Props {
  checked:  boolean;
  onToggle: () => void;
  label:    string;
  desc:     string;
}

export function ConsentToggleRow({ checked, onToggle, label, desc }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <DevLabel name="ConsentToggleRow" />
      <MotiView
        animate={{
          backgroundColor: checked ? accent.indigo : 'rgba(255,255,255,0.05)',
          borderColor:     checked ? accent.indigo : 'rgba(255,255,255,0.15)',
        }}
        transition={{ type: 'timing', duration: 160 }}
        style={styles.checkbox}
      >
        {checked && (
          <MotiView
            from={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          >
            <FontAwesome6 name="check" size={9} color="#fff" solid />
          </MotiView>
        )}
      </MotiView>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.desc}>{desc}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  text:  { flex: 1, gap: 2 },
  label: { fontFamily: font.bold, fontSize: 16, color: neutral.text },
  desc:  { fontFamily: font.ui, fontSize: 12, color: neutral.textDim, lineHeight: 16 },
});
