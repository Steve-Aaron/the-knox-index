import React from 'react';
import { MotiView } from 'moti';
import { ViewStyle } from 'react-native';

/**
 * EntranceFade
 * -------------
 * The most common entrance animation in the app: opacity 0 → 1 with a small
 * translateY slide and a configurable delay. Used in dozens of places across
 * dashboard cards, score cards, post bangers, account hero, etc.
 *
 * Use this instead of writing the same MotiView from/animate/transition
 * trio every time. If you need a non-default animation, fall back to a raw
 * MotiView — this primitive only covers the canonical case.
 *
 * One job: standardise the fade-in entrance.
 */

interface Props {
  /** Stagger delay in ms. */
  delay?:     number;
  /** Duration in ms. Default 300. */
  duration?:  number;
  /** Initial Y offset in pixels (positive = slide up into place). Default 12. */
  offsetY?:   number;
  style?:     ViewStyle | ViewStyle[];
  children?:  React.ReactNode;
}

export function EntranceFade({
  delay = 0,
  duration = 300,
  offsetY = 12,
  style,
  children,
}: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: offsetY }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration, delay }}
      style={style}
    >
      {children}
    </MotiView>
  );
}
