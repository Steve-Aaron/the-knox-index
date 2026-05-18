import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { getDevPreview, setDevPreview, type DevPreviewState } from '@/lib/devPreview';
import { accent, neutral, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * DevPanel
 * ---------
 * Floating dev-only overlay rendered in the bottom-left corner.
 * Lets you force any UI state without clicking a real magic link.
 *
 * Visible only in __DEV__ + web builds. Renders nothing in production.
 *
 * States:
 *   Gate   — unregistered at scroll threshold (CTA bar visible)
 *   Signup — registered, not yet profiled (profiling modal fires)
 *   Full   — registered and profiled (fully unlocked)
 *   Reset  — clears all overrides and auth state back to anonymous
 *
 * One job: control dev preview state.
 */

if (!__DEV__ || Platform.OS !== 'web') {
  // Bail out entirely in production or non-web — no runtime cost at all
}

const BUTTONS: { state: DevPreviewState | 'off'; label: string; color: string }[] = [
  { state: 'gate',   label: 'Gate',   color: '#FFB547' },
  { state: 'signup', label: 'Signup', color: '#7C83FF' },
  { state: 'full',   label: 'Full',   color: '#3DFFC0' },
  { state: 'off',    label: 'Reset',  color: '#6C6C82' },
];

export function DevPanel() {
  const [expanded, setExpanded] = useState(false);
  const current = getDevPreview();

  if (!__DEV__ || Platform.OS !== 'web') return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.heading}>DEV PREVIEW</Text>
          <View style={styles.btnRow}>
            {BUTTONS.map(({ state, label, color }) => {
              const active = state === current || (state === 'off' && current === 'off');
              return (
                <Pressable
                  key={state}
                  onPress={() => setDevPreview(state as DevPreviewState)}
                  style={({ pressed }) => [
                    styles.btn,
                    { borderColor: color },
                    active && { backgroundColor: color + '28' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.btnText, { color }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {current !== 'off' && (
            <Text style={styles.status}>
              Active: <Text style={{ color: neutral.text }}>{current}</Text>
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.toggleText}>{expanded ? '✕' : '⚙ DEV'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position:  'absolute' as any,
    bottom:    spacing.xl,
    left:      spacing.base,
    zIndex:    9999,
    alignItems: 'flex-start',
    gap:       spacing.xs,
    ...Platform.select({ web: { position: 'fixed' } as any, default: {} }),
  },
  panel: {
    backgroundColor: 'rgba(10,10,20,0.96)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    minWidth:        200,
    ...Platform.select({
      web: {
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            '0 8px 32px rgba(0,0,0,0.6)',
      } as any,
      default: {},
    }),
  },
  heading: {
    fontFamily:    font.bold,
    fontSize:      12,
    color:         neutral.textDim,
    letterSpacing: 1.5,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  btn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
    borderRadius:      radius.pill,
    borderWidth:       1,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  btnText: {
    fontFamily: font.bold,
    fontSize:   12,
    letterSpacing: 0.5,
  },
  status: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textDim,
  },
  toggle: {
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth:     1,
    borderColor:     glass.border,
    borderRadius:    radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    ...Platform.select({
      web: {
        cursor:               'pointer',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
      default: {},
    }),
  },
  toggleText: {
    fontFamily: font.bold,
    fontSize:   12,
    color:      accent.indigo,
    letterSpacing: 0.8,
  },
});
