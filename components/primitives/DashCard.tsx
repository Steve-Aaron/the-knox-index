import React from 'react';
import type { ViewStyle } from 'react-native';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { brand } from '@/theme/colors';
import { radius as defaultRadius } from '@/theme/spacing';

/**
 * DashCard
 * ---------
 * Standard surface for every dashboard panel. One job: be the single card
 * primitive so all panels share identical radius, accent, and flatTop behaviour
 * without each component managing those props manually.
 *
 * Defaults:
 *   radius    = radius.lg  (22)
 *   flatTop   = true       (squared top-left + top-right, rounded bottom)
 *   topAccent = brand.gradient (horizontal Knox gradient bar)
 *
 * Override any default by passing the prop explicitly. Pass
 * topAccent={undefined} to suppress the accent bar when a component
 * renders its own (e.g. PostsTable's pink strip, PoliticianDetailPanel's
 * party-colour strip).
 */

interface Props {
  children?:   React.ReactNode;
  style?:      ViewStyle;
  radius?:     number;
  flatTop?:    boolean;
  topAccent?:  string | readonly string[] | undefined;
  intensity?:  number;
}

export function DashCard({
  children,
  style,
  radius    = defaultRadius.lg,
  flatTop   = true,
  topAccent = [...brand.gradient] as string[],
  intensity,
}: Props) {
  return (
    <GlassSurface
      style={style}
      radius={radius}
      flatTop={flatTop}
      topAccent={topAccent}
      intensity={intensity}
    >
      {children}
    </GlassSurface>
  );
}
