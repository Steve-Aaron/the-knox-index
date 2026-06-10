import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { getDevPreview, setDevPreview, type DevPreviewState } from '@/lib/devPreview';
import { neutral, glass, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * DevPanel
 * ---------
 * Persistent floating toolbar docked bottom-centre.
 * Shows the active dev preview state and lets you tap any state to switch.
 * Renders only in __DEV__ + web. Zero runtime cost in production.
 *
 * One job: control dev preview state without typing URLs.
 */

const STATES: { state: DevPreviewState; label: string; color: string }[] = [
  { state: 'off',    label: 'Off',    color: '#6C6C82' },
  { state: 'gate',   label: 'Gate',   color: '#FFB547' },
  { state: 'signup', label: 'Signup', color: '#5F64BD' },
  { state: 'full',   label: 'Full',   color: '#3DFFC0' },
];

export function DevPanel() {
  if (!__DEV__ || Platform.OS !== 'web') return null;

  const current = getDevPreview();

  function goToAdmin() {
    document.cookie = 'admin_panel=1; Path=/';
    window.location.href = '/admin';
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 240 }}
        style={styles.bar}
      >
        <Text style={styles.label}>DEV</Text>
        <View style={styles.divider} />
        {STATES.map(({ state, label, color }) => {
          const active = state === current;
          return (
            <Pressable
              key={state}
              onPress={() => setDevPreview(state)}
              style={({ pressed }) => [
                styles.pill,
                active && { backgroundColor: color + '28', borderColor: color },
                pressed && { opacity: 0.7 },
              ]}
            >
              {active && (
                <View style={[styles.activeDot, { backgroundColor: color }]} />
              )}
              <Text style={[styles.pillText, { color: active ? color : neutral.textDim }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.divider} />
        <Pressable
          onPress={goToAdmin}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.pillText, { color: knox.primaryOrange }]}>Admin</Text>
        </Pressable>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position:       'absolute' as any,
    bottom:         spacing.xl,
    left:           0,
    right:          0,
    alignItems:     'center',
    zIndex:         9999,
    pointerEvents:  'box-none' as any,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  bar: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.xs,
    backgroundColor: 'rgba(10,10,20,0.90)',
    borderWidth:    1,
    borderColor:    glass.border,
    borderRadius:   radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    ...Platform.select({
      web: {
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            '0 4px 24px rgba(0,0,0,0.55)',
        cursor:               'default',
      } as any,
      default: {},
    }),
  },
  label: {
    fontFamily:    font.bold,
    fontSize:      10,
    color:         neutral.textDim,
    letterSpacing: 1.8,
    paddingHorizontal: 2,
  },
  divider: {
    width:           1,
    height:          14,
    backgroundColor: glass.border,
    marginHorizontal: 2,
  },
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              5,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:     radius.pill,
    borderWidth:      1,
    borderColor:      'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  activeDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  pillText: {
    fontFamily:    font.bold,
    fontSize:      11,
    letterSpacing: 0.4,
  },
});
