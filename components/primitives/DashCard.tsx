import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { InfoTip } from '@/components/primitives/InfoTip';
import { DevLabel } from '@/components/primitives/DevLabel';
import { brand } from '@/theme/colors';
import { radius as defaultRadius, spacing } from '@/theme/spacing';

/**
 * DashCard
 * ---------
 * Standard surface for every dashboard panel.
 *
 * Optionally accepts `infoText`. When provided, the shared `InfoTip` helper
 * is rendered in the top-right corner of the card. All helper behaviour —
 * the ? badge, the centred modal, the analytics event, the close affordance
 * — lives inside InfoTip so every helper in the app looks and behaves
 * identically (matching the 'Reach looks healthy for size' helper).
 *
 * `infoTitle` is accepted but ignored — it is kept on the type so existing
 * call sites continue to compile. The InfoTip modal always shows the canonical
 * 'What does this mean?' header.
 */

interface Props {
  children?:   React.ReactNode;
  style?:      ViewStyle;
  radius?:     number;
  flatTop?:    boolean;
  topAccent?:  string | readonly string[] | undefined;
  intensity?:  number;
  /** Explanation shown when the ? helper is pressed. Rendered via InfoTip. */
  infoText?:   string;
  /** Deprecated: kept for backwards compatibility, no longer rendered. */
  infoTitle?:  string;
}

export function DashCard({
  children,
  style,
  radius    = defaultRadius.lg,
  flatTop   = true,
  topAccent = [...brand.gradient] as string[],
  intensity,
  infoText,
}: Props) {
  return (
    <GlassSurface
      style={style}
      radius={radius}
      flatTop={flatTop}
      topAccent={topAccent}
      intensity={intensity}
    >
      <DevLabel name="DashCard" />
      {children}

      {/* ── Shared helper in the top-right corner ──────────────────── */}
      {infoText ? (
        <View
          style={styles.helperSlot}
          pointerEvents="box-none"
          {...(Platform.OS === 'web' ? { 'data-component': 'DashCardHelper' } as any : {})}
        >
          <InfoTip text={infoText} width={320} />
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  // Anchor InfoTip in the top-right corner of the card. The wrapping View
  // exists so InfoTip's absolute backdrop has a stable parent, and so the
  // slot itself can be addressed via data-component for instrumentation.
  helperSlot: {
    position: 'absolute',
    top:      spacing.xl,
    right:    spacing.lg,
    zIndex:   10,
  },
});
